// Plan lifecycle: create (propose) -> approve | reject -> execute. Creation never edits a timeline.
// Execution is idempotent, conflict-checked against the timeline version the plan was made on, and
// writes one timeline version for the whole plan.
import crypto from "crypto";
import ErrorHandler from "../utils/ErrorHandler";
import { loadProject, Principal, latest, contextFor, applyEditBatch } from "./operations";
import { MediaAsset, ReelPlan, Transcript } from "./models";
import { PlannerModel, plannerModel } from "./planner/gemini";
import { MAX_OPS, PlanOp, PlanReply, catalog, parsePlanReply, planReplySchema, validatePlan } from "./planner/plan";
import { ProviderNotConfigured } from "./jobs";
import { Timeline, timelineSchema, totalDuration } from "./schema";
import { SKILLS } from "./skills";
import { analyzeTelugu } from "./skills/teluguTenglish";
import { analyzeStory, buildPhrases, selectionToOps } from "./skills/talkingHead";
import { checkQuality } from "./skills/qualityController";
import { SkillContext } from "./skills/types";

const note = (event: string, by: string, n?: string) => ({ at: new Date(), by, event, note: n });

/** Public view of a timeline for the model: no storage keys, only ids, times and counts. */
const timelineForModel = (t: Timeline) => ({
  version: t.version, durationSeconds: +totalDuration(t).toFixed(2), output: t.output,
  sources: Object.fromEntries(Object.entries(t.sources).map(([k, s]) => [k, { duration: s.duration, width: s.width, height: s.height, hasAudio: s.hasAudio }])),
  tracks: t.tracks.map((tr) => ({ id: tr.id, kind: tr.kind, clips: tr.clips.slice(0, 60).map((c) => ({ id: c.id, sourceId: c.sourceId, start: +c.start.toFixed(2), duration: +c.duration.toFixed(2), in: c.in, out: c.out, text: c.words ? c.words.map((w) => w.w).join(" ").slice(0, 60) : c.text?.value })), clipCount: tr.clips.length })),
});

export const buildSkillContext = async (projectId: string, t: Timeline, preferences: SkillContext["preferences"]): Promise<SkillContext> => {
  const assets: any[] = await MediaAsset.find({ project: projectId });
  const first = assets[0];
  let transcript: SkillContext["transcript"];
  if (first) {
    const rows: any[] = await Transcript.find({ asset: String(first._id), project: projectId });
    const tr = rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    if (tr) transcript = { assetId: String(first._id), language: tr.language, script: tr.script, words: tr.words.map((w: any) => ({ w: w.w, roman: w.roman, start: w.start, end: w.end, speaker: w.speaker, lang: w.lang })) };
  }
  return { timeline: t, assets: assets.map((a) => ({ id: String(a._id), duration: a.duration, silences: a.probe?.silences ?? [], loudnessLufs: a.probe?.loudnessLufs })), transcript, preferences };
};

const systemPrompt = () => `You are the ReelFlow creative director planning edits for a short vertical video.
You may only propose operations from the CATALOG below. You never write ffmpeg commands, file paths, URLs or code.
Return ONE JSON object: {"summary": string, "storySelection"?: {"hookPhraseId","keepPhraseIds","rationale"}, "ops": [{"op","args","rationale"}]}.
- Use clip ids, track ids and source ids exactly as given in TIMELINE. Times are seconds.
- To shorten or choose a story, use storySelection with phrase ids from CANDIDATE_PHRASES. Do NOT write remove_range for story cuts yourself; the server converts storySelection into cuts.
- Each rationale is one plain sentence an editor would accept.
- Propose at most ${MAX_OPS} ops. If the request cannot be done with the catalog, return ops: [] and explain in summary.
Editorial rules:
${SKILLS.map((s) => `## ${s.name}\n${s.rules.map((r) => `- ${r}`).join("\n")}`).join("\n")}
CATALOG:
${JSON.stringify(catalog())}`;

export interface CreatePlanOptions { idempotencyKey?: string; preferences?: SkillContext["preferences"]; model?: PlannerModel }

export const createPlan = async (p: Principal, projectId: string, instruction: string, o: CreatePlanOptions = {}) => {
  await loadProject(p, projectId, "upload_version");
  if (o.idempotencyKey) {
    const dup: any = await ReelPlan.findOne({ project: projectId, idempotencyKey: o.idempotencyKey });
    if (dup) return dup; // same key, same plan: safe retry
  }
  const cur: any = await latest(projectId);
  if (!cur) throw new ErrorHandler(404, "No timeline yet. Upload media first.");
  const model = o.model ?? plannerModel();
  if (!model.configured()) throw new ProviderNotConfigured(model.name, model.envVar);
  const base = timelineSchema.parse(cur.doc);
  const sk = await buildSkillContext(projectId, base, o.preferences);
  const analyses = {
    "telugu-tenglish-editor": analyzeTelugu(sk),
    "talking-head-story-editor": analyzeStory(sk),
    "video-quality-controller": checkQuality(sk),
  };
  const user = JSON.stringify({
    INSTRUCTION: instruction, PREFERENCES: o.preferences ?? {}, TIMELINE: timelineForModel(base),
    MEDIA: sk.assets, TRANSCRIPT_LANGUAGE: sk.transcript?.language, CANDIDATE_PHRASES: analyses["talking-head-story-editor"].candidates.slice(0, 200),
    SKILL_ANALYSIS: Object.fromEntries(Object.entries(analyses).map(([k, v]: any) => [k, { findings: v.findings, recommendations: v.recommendations, checks: v.checks }])),
  });
  let history: { role: "user" | "assistant"; text: string }[] = [];
  let reply: ReturnType<typeof parsePlanReply> = { ok: false, error: "no reply" };
  for (let n = 0; n < 3; n++) {
    const text = await model.generate(systemPrompt(), user, history);
    reply = parsePlanReply(text);
    if (reply.ok) break;
    history = [...history, { role: "assistant", text: text.slice(0, 4000) }, { role: "user", text: `Your reply was invalid: ${reply.error}. Reply again with one corrected JSON object only.` }];
  }
  if (!reply.ok) throw new ErrorHandler(502, `Planner returned invalid output: ${reply.error}`);
  const data = reply.data;

  return persistPlan(p, projectId, base, sk, instruction, data, { provider: model.name, model: model.model }, o.idempotencyKey);
};

/**
 * Shared by the Gemini planner and by external agents (Claude over MCP): both end up with the SAME kind
 * of proposed plan, validated by the same code, approved and executed by the same functions.
 */
const persistPlan = async (p: Principal, projectId: string, base: Timeline, sk: SkillContext, instruction: string, data: PlanReply, model: { provider: string; model: string }, idempotencyKey?: string) => {
  const raw: Parameters<typeof validatePlan>[1] = [];
  const extraWarnings: string[] = [];
  if (data.storySelection) {
    const src = sk.transcript?.assetId;
    if (!src) throw new ErrorHandler(422, "storySelection needs a transcript");
    try {
      const sel = selectionToOps(base, src, buildPhrases(sk.transcript!.words), data.storySelection);
      sel.steps.forEach((s) => raw.push({ op: s.op, args: s.args, rationale: data.storySelection!.rationale.slice(0, 500), source: "story_skill" }));
      extraWarnings.push(...sel.warnings);
    } catch (e: any) { throw new ErrorHandler(422, `Rejected story selection: ${e.message}`); }
  }
  for (const m of data.ops) raw.push({ ...m, source: "model" });
  if (raw.length > MAX_OPS * 3) throw new ErrorHandler(422, "Plan is too large");
  const v = await validatePlan(base, raw, contextFor(projectId));
  if (extraWarnings.length && v.ops[0]) v.ops[0].warnings.push(...extraWarnings);
  return ReelPlan.create({
    project: projectId, owner: p.userId, instruction, idempotencyKey, baseVersion: base.version, status: "proposed",
    summary: data.summary, ops: v.ops, preview: v.preview, model, skills: SKILLS.map((s) => s.name),
    history: [note("proposed", p.userId, `${v.ops.length} ops, ${v.preview.opsInvalid} invalid`)],
  });
};

/** An external agent (e.g. Claude through MCP) proposes its own plan. Same validation, same approval gate. */
export const submitPlan = async (p: Principal, projectId: string, input: unknown, o: { instruction?: string; idempotencyKey?: string; preferences?: SkillContext["preferences"]; agent?: string } = {}) => {
  await loadProject(p, projectId, "upload_version");
  if (o.idempotencyKey) {
    const dup: any = await ReelPlan.findOne({ project: projectId, idempotencyKey: o.idempotencyKey });
    if (dup) return dup;
  }
  const parsed = planReplySchema.safeParse(input);
  if (!parsed.success) throw new ErrorHandler(422, `Invalid plan: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
  const cur: any = await latest(projectId);
  if (!cur) throw new ErrorHandler(404, "No timeline yet. Upload media first.");
  const base = timelineSchema.parse(cur.doc);
  const sk = await buildSkillContext(projectId, base, o.preferences);
  return persistPlan(p, projectId, base, sk, o.instruction ?? parsed.data.summary, parsed.data, { provider: "external", model: o.agent ?? "agent" }, o.idempotencyKey);
};

export const getPlan = async (p: Principal, projectId: string, planId: string) => {
  await loadProject(p, projectId);
  const plan: any = /^[a-f0-9]{24}$/i.test(planId) ? await ReelPlan.findOne({ _id: planId, project: projectId }) : null;
  if (!plan) throw new ErrorHandler(404, "Plan not found");
  return plan;
};
export const listPlans = async (p: Principal, projectId: string) => {
  await loadProject(p, projectId);
  const rows: any[] = await ReelPlan.find({ project: projectId });
  return rows.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
};

export const rejectPlan = async (p: Principal, projectId: string, planId: string, reason: string) => {
  await loadProject(p, projectId, "upload_version");
  const plan = await getPlan(p, projectId, planId);
  if (plan.status !== "proposed" && plan.status !== "approved") throw new ErrorHandler(409, `A ${plan.status} plan cannot be rejected`);
  plan.status = "rejected"; plan.rejectionReason = reason.slice(0, 500); plan.history.push(note("rejected", p.userId, reason.slice(0, 200)));
  await plan.save();
  return plan;
};

/** Approves all valid ops, or the listed subset. Re-validates against the CURRENT timeline first. */
export const approvePlan = async (p: Principal, projectId: string, planId: string, opIds?: string[]) => {
  await loadProject(p, projectId, "upload_version");
  const plan = await getPlan(p, projectId, planId);
  if (plan.status !== "proposed") throw new ErrorHandler(409, `Only a proposed plan can be approved (this one is ${plan.status})`);
  const cur: any = await latest(projectId);
  if (cur.version !== plan.baseVersion) {
    plan.status = "superseded"; plan.history.push(note("superseded", p.userId, `timeline moved to v${cur.version}`)); await plan.save();
    throw new ErrorHandler(409, `The timeline changed (now v${cur.version}); this plan was made on v${plan.baseVersion}. Ask for a new plan.`);
  }
  const chosen = new Set(opIds ?? plan.ops.filter((o: PlanOp) => o.valid).map((o: PlanOp) => o.id));
  const unknown = [...chosen].filter((id) => !plan.ops.some((o: PlanOp) => o.id === id));
  if (unknown.length) throw new ErrorHandler(422, `Unknown operation ids: ${unknown.join(", ")}`);
  const bad = plan.ops.filter((o: PlanOp) => chosen.has(o.id) && !o.valid);
  if (bad.length) throw new ErrorHandler(422, `Cannot approve invalid operations: ${bad.map((o: PlanOp) => `${o.id} (${o.error})`).join("; ")}`);
  if (!chosen.size) throw new ErrorHandler(422, "Nothing to approve");
  // the chosen subset must still validate as a sequence
  const subset = plan.ops.filter((o: PlanOp) => chosen.has(o.id));
  const v = await validatePlan(timelineSchema.parse(cur.doc), subset.map((o: PlanOp) => ({ op: o.op, args: o.args, rationale: o.rationale, source: o.source })), contextFor(projectId));
  if (v.preview.opsInvalid) throw new ErrorHandler(422, `The selected operations do not work together: ${v.ops.find((o) => !o.valid)?.error}`);
  plan.ops.forEach((o: PlanOp) => { o.approved = chosen.has(o.id); });
  plan.status = "approved"; plan.history.push(note("approved", p.userId, `${chosen.size} ops`));
  await plan.save();
  return plan;
};

export const executePlan = async (p: Principal, projectId: string, planId: string) => {
  await loadProject(p, projectId, "upload_version");
  const plan = await getPlan(p, projectId, planId);
  if (plan.status === "executed") return plan; // idempotent
  if (plan.status !== "approved") throw new ErrorHandler(409, `Approve the plan before executing it (status: ${plan.status})`);
  const claim = await ReelPlan.updateOne({ _id: plan._id, status: "approved" }, { status: "executing" });
  if (!claim.matchedCount && !claim.modifiedCount) return getPlan(p, projectId, planId); // someone else is executing
  try {
    const steps = plan.ops.filter((o: PlanOp) => o.approved).map((o: PlanOp) => ({ op: o.op, args: o.args }));
    const row: any = await applyEditBatch(p, projectId, steps, plan.baseVersion, `plan ${String(plan._id).slice(-6)}: ${plan.summary}`);
    const fresh = await getPlan(p, projectId, planId);
    fresh.status = "executed"; fresh.resultVersion = row.version; fresh.history.push(note("executed", p.userId, `timeline v${row.version}`));
    await fresh.save();
    return fresh;
  } catch (e: any) {
    const fresh = await getPlan(p, projectId, planId);
    fresh.status = e?.statusCode === 409 ? "superseded" : "failed"; fresh.error = String(e.message).slice(0, 500); fresh.history.push(note(fresh.status, p.userId, fresh.error));
    await fresh.save();
    throw e;
  }
};

export const planJson = (pl: any) => ({
  id: String(pl._id), status: pl.status, instruction: pl.instruction, summary: pl.summary, baseVersion: pl.baseVersion, resultVersion: pl.resultVersion,
  ops: pl.ops, preview: pl.preview, model: pl.model, history: pl.history, rejectionReason: pl.rejectionReason, error: pl.error,
});

/** Dry-run of caller-supplied operations against the latest timeline. Saves nothing. */
export const dryRunOps = async (p: Principal, projectId: string, ops: { op: string; args?: Record<string, unknown> }[]) => {
  await loadProject(p, projectId);
  const cur: any = await latest(projectId);
  if (!cur) throw new ErrorHandler(404, "No timeline yet. Upload media first.");
  const v = await validatePlan(timelineSchema.parse(cur.doc), ops.map((o) => ({ op: o.op, args: o.args ?? {}, rationale: "dry run", source: "model" as const })), contextFor(projectId));
  return { baseVersion: cur.version, ops: v.ops.map((o) => ({ id: o.id, op: o.op, valid: o.valid, error: o.error, warnings: o.warnings, target: o.target })), preview: v.preview };
};
