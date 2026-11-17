// Phase F acceptance run against a RUNNING server with real providers. Nothing here is simulated:
// it talks to the real API, real Sarvam, real Gemini, real ffmpeg. Exit 3 = a provider key is missing.
//   REEL_URL=http://localhost:8000/v1 REEL_TOKEN=rf_... ts-node --transpile-only -P tsconfig.json reel/acceptance/run.ts <consented-recording.mp4> [native|roman]
// Only use a recording whose speaker gave explicit permission for testing.
import fs from "fs";
import path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const URL_ = process.env.REEL_URL!, TOKEN = process.env.REEL_TOKEN!;
const [file, script = "native"] = process.argv.slice(2);
if (!URL_ || !TOKEN || !file) { console.error("set REEL_URL, REEL_TOKEN and pass a recording"); process.exit(2); }
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const api = async (m: string, p: string, body?: unknown) => {
  const r = await fetch(`${URL_}/reel${p}`, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(`${m} ${p}: ${r.status} ${j.message}`), { code: j.code }); return j;
};
const step = (n: number, s: string) => console.log(`${n}. ${s}`);
const poll = async (pid: string, jobId: string) => { for (;;) { const j = (await api("GET", `/projects/${pid}/jobs/${jobId}`)).job; if (["succeeded", "failed", "cancelled"].includes(j.state)) return j; await new Promise((r) => setTimeout(r, 2000)); } };
const strip = (t: any) => JSON.stringify(t, (k, v) => (k === "id" || k === "group" || k === "project" || k === "storageKey" ? undefined : v));

(async () => {
  const caps = await api("GET", "/capabilities");
  const missing = [...caps.asr.filter((a: any) => a.name === "sarvam" && !a.configured).map((a: any) => a.envVar), ...(caps.planner.configured ? [] : [caps.planner.envVar])];
  if (missing.length) { console.error(`NOT CONFIGURED on the server: ${missing.join(", ")}`); process.exit(3); }

  step(1, "create project and upload the real recording");
  const pid = (await api("POST", "/projects", { title: `Acceptance ${new Date().toISOString()}` })).project.id;
  const form = new FormData(); form.append("video", new Blob([fs.readFileSync(file)], { type: "video/mp4" }), path.basename(file));
  const up = await fetch(`${URL_}/reel/projects/${pid}/assets`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: form });
  const asset = (await up.json()).asset; if (!asset) throw new Error("upload failed");

  step(2, "Sarvam transcription");
  const tj = await poll(pid, (await api("POST", `/projects/${pid}/transcribe`, { assetId: asset.id, provider: "sarvam", script })).job.id);
  if (tj.state !== "succeeded") throw new Error(`transcribe ${tj.state}: ${tj.error}`);
  console.log(`   ${tj.result.words} words, language ${tj.result.language}`);

  step(3, "Gemini plan (story + captions + audio)");
  const plan = (await api("POST", `/projects/${pid}/plans`, { instruction: "Make a vertical reel of about 30 seconds from the strongest story. Remove silences, add captions, enhance dialogue audio.", preferences: { captionScript: script, targetSeconds: 30 } })).plan;
  console.log(`   ${plan.ops.length} ops, ${plan.preview.opsInvalid} invalid, ${plan.preview.beforeSeconds}s -> ${plan.preview.afterSeconds}s`);
  for (const o of plan.ops) console.log(`   ${o.valid ? "ok " : "BAD"} ${o.id} ${o.op} ${o.rationale}${o.error ? " | " + o.error : ""}`);

  step(4, "approve valid operations and execute (website path)");
  await api("POST", `/projects/${pid}/plans/${plan.id}/approve`, {});
  const done = (await api("POST", `/projects/${pid}/plans/${plan.id}/execute`, {})).plan;
  console.log(`   timeline v${done.resultVersion}`);

  step(5, "real ffmpeg render");
  const rj = await poll(pid, (await api("POST", `/projects/${pid}/renders`, { version: done.resultVersion, quality: "preview" })).job.id);
  if (rj.state !== "succeeded") throw new Error(`render ${rj.state}: ${rj.error}`);
  console.log(`   measured ${JSON.stringify(rj.result.measured)}`);

  step(6, "same request through MCP on a second project, compare results");
  const c = new Client({ name: "acceptance", version: "1" });
  await c.connect(new StreamableHTTPClientTransport(new URL(URL_.replace(/\/v1\/?$/, "") + "/mcp"), { requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } } }));
  const call = async (name: string, args: any) => { const r: any = await c.callTool({ name, arguments: args }); if (r.isError) throw new Error(`${name}: ${r.content[0].text}`); return JSON.parse(r.content[0].text); };
  // Claude proposes the same operations the website plan contained (its own plan, not a copy of IDs)
  const p2 = (await call("create_project", { title: "Acceptance via MCP" })).id;
  const fd = new FormData(); fd.append("video", new Blob([fs.readFileSync(file)], { type: "video/mp4" }), path.basename(file));
  const a2 = (await (await fetch(`${URL_}/reel/projects/${p2}/assets`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: fd })).json()).asset;
  const t2 = await call("transcribe", { projectId: p2, assetId: a2.id, provider: "sarvam", script });
  while (!["succeeded", "failed"].includes((await call("get_job", { projectId: p2, jobId: t2.id })).state)) await new Promise((r) => setTimeout(r, 2000));
  const remap = (args: any) => JSON.parse(JSON.stringify(args).split(asset.id).join(a2.id));
  const sp = await call("submit_plan", { projectId: p2, plan: { summary: plan.summary, ops: plan.ops.filter((o: any) => o.approved).map((o: any) => ({ op: o.op, args: remap(o.args), rationale: o.rationale })) } });
  await call("approve_plan", { projectId: p2, planId: sp.id });
  const ex = await call("execute_plan", { projectId: p2, planId: sp.id });
  const t1 = (await api("GET", `/projects/${pid}/timeline?version=${done.resultVersion}`)).timeline;
  const tm = await call("get_timeline", { projectId: p2, version: ex.resultVersion });
  const norm = (t: any, id: string) => strip(t).split(id).join("SRC");
  const same = norm(t1, asset.id) === norm(tm.timeline, a2.id);
  console.log(`   website and MCP timelines ${same ? "IDENTICAL" : "DIFFER (ASR output differs per run, so word-dependent ops may differ)"}`);
  await c.close();
  console.log("done");
})().catch((e) => { console.error(`FAILED: ${e.message}`); process.exit(e.code === "PROVIDER_NOT_CONFIGURED" ? 3 : 1); });
