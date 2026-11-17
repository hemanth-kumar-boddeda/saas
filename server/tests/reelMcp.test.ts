// MCP over real Streamable HTTP with the official SDK client, plus the parity check: the same plan driven
// through the website API and through MCP must leave identical timeline and version history.
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";

const m = await vi.hoisted(async () => {
  const { createFakeModel } = await import("./helpers/fakeModel");
  return {
    Project: createFakeModel({ status: "in_review", currentVersion: 0, editors: [] }),
    ProjectVersion: createFakeModel(), ReviewComment: createFakeModel(), ReviewLink: createFakeModel(), Approval: createFakeModel(),
    MediaAsset: createFakeModel(), ReelTimeline: createFakeModel({ renders: [], approved: false }), Transcript: createFakeModel(),
    ReelJob: createFakeModel({ state: "queued", attempts: 0, maxAttempts: 2, progress: 0 }), ApiToken: createFakeModel({ revoked: false }), UsageEvent: createFakeModel(),
    ReelPlan: createFakeModel({ status: "proposed", history: [] }),
  };
});
vi.mock("../models/review.model", () => ({ Project: m.Project, ProjectVersion: m.ProjectVersion, ReviewComment: m.ReviewComment, ReviewLink: m.ReviewLink, Approval: m.Approval }));
vi.mock("../models/publishkit.model", () => ({ PublishKit: (globalThis as any).__kit ??= { find: async () => [], create: async () => ({}) }, Channel: {} }));
vi.mock("../reel/models", () => m);
vi.mock("../reel/queue", () => ({ enqueueJob: vi.fn() }));
vi.mock("../jobs/publishKit", () => ({ enqueueKit: vi.fn() }));
vi.mock("../controllers/user.controller", () => ({ generateAccessToken: (_q: any, _r: any, n: any) => n() }));
vi.mock("../middleware/auth", async () => {
  const { default: ErrorHandler } = await import("../utils/ErrorHandler");
  return { isAuthenticated: (req: any, _r: any, n: any) => { const id = req.headers["x-user"]; if (!id) return n(new ErrorHandler(401, "login")); req.user = { _id: id, name: id }; n(); } };
});
vi.mock("../middleware/rateLimit", () => ({ reelIpLimiter: (_q: any, _r: any, n: any) => n(), reelPlanLimiter: (_q: any, _r: any, n: any) => n() }));

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import reelRouter from "../reel/routes";
import { mcpRouter } from "../reel/mcp/http";
import { ErrorMiddleware } from "../middleware/error";
import { createApiToken } from "../reel/apiTokens";
import { EDIT_OPS } from "../reel/registry";
import { makeSampleVideo } from "../utils/transcode";

const app = express(); app.use(express.json());
app.use("/v1/", reelRouter);
app.use(mcpRouter({ enqueueJob: async () => {}, enqueueKit: async () => {} }));
app.use(ErrorMiddleware);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reelmcp-"));
process.env.STORAGE_DIR = path.join(dir, "storage");
const sample = path.join(dir, "s.mp4");
let server: http.Server, url: string;
beforeAll(async () => { await makeSampleVideo(sample, "testsrc2", 20); await new Promise<void>((r) => { server = app.listen(0, () => r()); }); url = `http://127.0.0.1:${(server.address() as any).port}/mcp`; }, 30000);
afterAll(() => { server.close(); });
beforeEach(() => { for (const x of Object.values(m)) (x as any).rows.length = 0; });

const as = (u: string) => ({ "x-user": u });
const connect = async (token: string) => {
  const c = new Client({ name: "test", version: "1" });
  await c.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return c;
};
const call = async (c: Client, name: string, args: any) => { const r: any = await c.callTool({ name, arguments: args }); const t = r.content[0].text; return { error: r.isError ? t : null, data: r.isError ? null : JSON.parse(t) }; };
const mkProject = async (u = "owner") => {
  const pid = (await request(app).post("/v1/reel/projects").set(as(u)).send({ title: "T" })).body.project.id as string;
  const asset = (await request(app).post(`/v1/reel/projects/${pid}/assets`).set(as(u)).attach("video", sample, { contentType: "video/mp4" })).body.asset;
  return { pid, aid: asset.id as string };
};
const tok = (owner: string, scopes: any[]) => createApiToken(owner, "t", scopes).then((t) => t.raw);

describe("MCP transport and auth", () => {
  it("rejects missing/invalid tokens and non-POST", async () => {
    expect((await request(app).post("/mcp").send({})).status).toBe(401);
    expect((await request(app).post("/mcp").set("Authorization", "Bearer rf_bad").send({})).status).toBe(401);
    expect((await request(app).get("/mcp")).status).toBe(405);
  });
  it("lists tools generated from the registry plus workflow tools", async () => {
    const c = await connect(await tok("owner", ["reel:read"]));
    const names = (await c.listTools()).tools.map((t) => t.name);
    for (const o of EDIT_OPS) expect(names).toContain(`edit_${o.name}`);
    for (const n of ["create_plan", "submit_plan", "validate_operations", "approve_plan", "execute_plan", "get_timeline", "compare_versions", "render_preview", "get_job", "approve_timeline", "generate_publishing_package", "transcribe", "create_project"]) expect(names).toContain(n);
    const split: any = (await c.listTools()).tools.find((t) => t.name === "edit_split_clip");
    expect(Object.keys(split.inputSchema.properties)).toEqual(expect.arrayContaining(["projectId", "clipId", "at", "baseVersion"]));
    await c.close();
  });
  it("enforces scopes and ownership on tool calls", async () => {
    const { pid } = await mkProject("owner");
    const ro = await connect(await tok("owner", ["reel:read"]));
    expect((await call(ro, "create_project", { title: "x" })).error).toMatch(/lacks the reel:write/);
    expect((await call(ro, "get_timeline", { projectId: pid })).data.version).toBe(1);
    const evil = await connect(await tok("mallory", ["reel:read", "reel:write"]));
    expect((await call(evil, "get_timeline", { projectId: pid })).error).toMatch(/not found/i);
    expect((await call(evil, "edit_remove_range", { projectId: pid, from: 1, to: 2 })).error).toMatch(/not found/i);
    await ro.close(); await evil.close();
  });
  it("provider-not-configured is reported explicitly through MCP", async () => {
    const { pid } = await mkProject();
    delete process.env.GEMINI_API_KEY;
    const c = await connect(await tok("owner", ["reel:read", "reel:write"]));
    expect((await call(c, "create_plan", { projectId: pid, instruction: "make a reel" })).error).toMatch(/PROVIDER_NOT_CONFIGURED.*GEMINI_API_KEY/);
    await c.close();
  });
});

describe("website API and Claude/MCP produce identical edits", () => {
  const steps = [{ op: "remove_range", args: { from: 10, to: 14 }, rationale: "cut the dead stretch" }, { op: "reframe_vertical", args: { subjectX: 0.5 }, rationale: "vertical for reels" }];
  // ids are random per project; compare everything else (source ids are asset ids, mapped to SRC)
  const norm = (row: any) => {
    const ids = Object.keys(row.doc.sources);
    let j = JSON.stringify(row.doc, (k, v) => (k === "id" || k === "group" || k === "project" || k === "storageKey" ? undefined : v));
    for (const i of ids) j = j.split(i).join("SRC");
    return JSON.parse(j);
  };
  const shape = (rows: any[]) => rows.map((r) => ({ version: r.version, parent: r.parent, approved: r.approved, doc: norm(r) }));

  it("same plan, same final timeline, same version chain, same plan history", async () => {
    const web = await mkProject("owner"); const mcp = await mkProject("owner2");
    // website path (REST)
    const sub = await request(app).post(`/v1/reel/projects/${web.pid}/plans/submit`).set(as("owner")).send({ plan: { summary: "Tighten and reframe", ops: steps } });
    expect(sub.status).toBe(201);
    const wid = sub.body.plan.id;
    expect((await request(app).post(`/v1/reel/projects/${web.pid}/plans/${wid}/approve`).set(as("owner")).send({})).status).toBe(200);
    const ex = await request(app).post(`/v1/reel/projects/${web.pid}/plans/${wid}/execute`).set(as("owner")).send({});
    expect(ex.body.plan.status).toBe("executed");
    // Claude path (MCP)
    const c = await connect(await tok("owner2", ["reel:read", "reel:write", "reel:render"]));
    const s2 = await call(c, "submit_plan", { projectId: mcp.pid, plan: { summary: "Tighten and reframe", ops: steps } });
    expect(s2.error).toBeNull();
    const dry = await call(c, "validate_operations", { projectId: mcp.pid, operations: steps.map(({ op, args }) => ({ op, args })) });
    expect(dry.data.preview.opsInvalid).toBe(0);
    await call(c, "approve_plan", { projectId: mcp.pid, planId: s2.data.id });
    const e2 = await call(c, "execute_plan", { projectId: mcp.pid, planId: s2.data.id });
    expect(e2.data.status).toBe("executed");
    const again = await call(c, "execute_plan", { projectId: mcp.pid, planId: s2.data.id }); // idempotent
    expect(again.data.resultVersion).toBe(e2.data.resultVersion);

    const rowsOf = (pid: string) => m.ReelTimeline.rows.filter((r: any) => String(r.project) === pid).sort((a: any, b: any) => a.version - b.version);
    expect(shape(rowsOf(mcp.pid))).toEqual(shape(rowsOf(web.pid)));
    expect(rowsOf(web.pid).map((r: any) => r.version)).toEqual([1, 2]);
    const hist = (pid: string) => m.ReelPlan.rows.find((p: any) => String(p.project) === pid).history.map((h: any) => h.event);
    expect(hist(mcp.pid)).toEqual(hist(web.pid));
    // MCP read tools agree with REST
    const viaRest = (await request(app).get(`/v1/reel/projects/${mcp.pid}/timeline`).set(as("owner2"))).body;
    const viaMcp = (await call(c, "get_timeline", { projectId: mcp.pid })).data;
    expect(viaMcp).toEqual(JSON.parse(JSON.stringify({ version: viaRest.version, parent: viaRest.parent, approved: viaRest.approved, summary: viaRest.summary, renders: viaRest.renders, timeline: viaRest.timeline })));
    const cmp = await call(c, "compare_versions", { projectId: mcp.pid, from: 1, to: 2 });
    expect(cmp.data.durationSeconds.delta).toBeCloseTo(-4, 1);
    expect(cmp.data.output).toEqual({ from: { width: 640, height: 360, fps: 30 }, to: { width: 1080, height: 1920, fps: 30 } });
    await c.close();
  }, 60000);
  it("an edit tool and the REST edit endpoint give the same result", async () => {
    const a = await mkProject("owner"), b = await mkProject("owner2");
    await request(app).post(`/v1/reel/projects/${a.pid}/edits`).set(as("owner")).send({ op: "remove_range", args: { from: 3, to: 5 }, baseVersion: 1 });
    const c = await connect(await tok("owner2", ["reel:write", "reel:read"]));
    await call(c, "edit_remove_range", { projectId: b.pid, from: 3, to: 5, baseVersion: 1 });
    const rows = (pid: string) => m.ReelTimeline.rows.filter((r: any) => String(r.project) === pid).sort((x: any, y: any) => x.version - y.version);
    expect(shape(rows(b.pid))).toEqual(shape(rows(a.pid)));
    expect((await call(c, "edit_remove_range", { projectId: b.pid, from: 0, to: 1, baseVersion: 1 })).error).toMatch(/moved on/);
    await c.close();
  }, 30000);
});
