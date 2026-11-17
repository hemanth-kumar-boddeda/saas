// Planner tests. The model transport is a SCRIPTED TEST DOUBLE used only to exercise the validation,
// approval, conflict and idempotency machinery deterministically. It is never used by product code,
// and the live Gemini test at the bottom runs only when GEMINI_API_KEY is set.
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";

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
vi.mock("../reel/models", () => m);
vi.mock("../reel/queue", () => ({ enqueueJob: vi.fn() }));
vi.mock("../controllers/user.controller", () => ({ generateAccessToken: (_q: any, _r: any, n: any) => n() }));
vi.mock("../middleware/auth", async () => {
  const { default: ErrorHandler } = await import("../utils/ErrorHandler");
  return { isAuthenticated: (req: any, _r: any, n: any) => { const id = req.headers["x-user"]; if (!id) return n(new ErrorHandler(401, "login")); req.user = { _id: id, name: id }; n(); } };
});
vi.mock("../middleware/rateLimit", () => ({ reelIpLimiter: (_q: any, _r: any, n: any) => n(), reelPlanLimiter: (_q: any, _r: any, n: any) => n() }));

import reelRouter from "../reel/routes";
import { ErrorMiddleware } from "../middleware/error";
import { makeSampleVideo } from "../utils/transcode";
import * as planning from "../reel/planning";
import { parsePlanReply, catalog } from "../reel/planner/plan";
import { gemini, PlannerModel } from "../reel/planner/gemini";
import { ProviderNotConfigured } from "../reel/jobs";

const app = express(); app.use(express.json()); app.use("/v1/", reelRouter); app.use(ErrorMiddleware);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reelplan-"));
process.env.STORAGE_DIR = path.join(dir, "storage");
const sample = path.join(dir, "s.mp4");
beforeAll(async () => { await makeSampleVideo(sample, "testsrc2", 20); }, 30000);
beforeEach(() => { for (const x of Object.values(m)) (x as any).rows.length = 0; });
const as = (u: string) => ({ "x-user": u });

const scripted = (reply: unknown | (() => unknown)): PlannerModel & { calls: number } => {
  const s: any = { name: "scripted-test", model: "none", envVar: "-", configured: () => true, calls: 0,
    generate: async () => { s.calls++; const r = typeof reply === "function" ? (reply as any)() : reply; return typeof r === "string" ? r : JSON.stringify(r); } };
  return s;
};
const setup = async () => {
  const pid = (await request(app).post("/v1/reel/projects").set(as("owner")).send({ title: "T" })).body.project.id as string;
  const a = (await request(app).post(`/v1/reel/projects/${pid}/assets`).set(as("owner")).attach("video", sample, { contentType: "video/mp4" })).body.asset;
  return { pid, aid: a.id as string };
};
const seedTranscript = (aid: string, pid: string) => m.Transcript.create({ asset: aid, project: pid, provider: "test-input", words: [
  { w: "Hello", start: 0, end: .4 }, { w: "friends.", start: .5, end: 1 }, { w: "Important", start: 8, end: 8.5 }, { w: "point", start: 8.6, end: 9 }, { w: "here.", start: 9.1, end: 9.6 }, { w: "Bye.", start: 18, end: 18.5 }] });
const P = (u = "owner") => ({ userId: u });

describe("reply parsing", () => {
  it("accepts only registry operations, strips code fences, rejects junk", () => {
    expect(parsePlanReply('```json\n{"summary":"cut it","ops":[{"op":"remove_range","args":{"from":1,"to":2},"rationale":"dead air"}]}\n```').ok).toBe(true);
    expect(parsePlanReply('{"summary":"x y z w","ops":[{"op":"run_ffmpeg","args":{"cmd":"rm -rf /"},"rationale":"x"}]}').ok).toBe(false);
    expect(parsePlanReply('{"summary":"x y z w","ops":[{"op":"remove_range","rationale":"x y"}],"extra":1}').ok).toBe(true);
    expect(parsePlanReply("not json").ok).toBe(false);
  });
  it("catalog is generated from the registry", () => {
    const names = catalog().map((c) => c.op);
    expect(names).toContain("remove_silences");
    expect(JSON.stringify(catalog())).not.toMatch(/ffmpeg|path/i);
  });
});

describe("plan lifecycle", () => {
  it("not configured -> explicit 503, nothing stored", async () => {
    const { pid } = await setup();
    delete process.env.GEMINI_API_KEY;
    const r = await request(app).post(`/v1/reel/projects/${pid}/plans`).set(as("owner")).send({ instruction: "make it shorter" });
    expect(r.status).toBe(503); expect(r.body.message).toMatch(/GEMINI_API_KEY/);
    expect(m.ReelPlan.rows).toHaveLength(0);
    await expect(planning.createPlan(P(), pid, "x y z", { model: { ...gemini, configured: () => false } as any })).rejects.toBeInstanceOf(ProviderNotConfigured);
  });
  it("propose validates every op deterministically; invalid ops are flagged and cannot be approved", async () => {
    const { pid, aid } = await setup();
    const plan = await planning.createPlan(P(), pid, "tighten", { model: scripted({ summary: "Remove dead air and a bad clip", ops: [
      { op: "remove_range", args: { from: 2, to: 4 }, rationale: "dead air" },
      { op: "remove_range", args: { from: 500, to: 600 }, rationale: "impossible" },
      { op: "split_clip", args: { clipId: "ghost", at: 1 }, rationale: "bad id" },
      { op: "add_captions", args: { sourceId: aid }, rationale: "needs transcript" }] }) });
    expect(plan.status).toBe("proposed");
    expect(plan.ops.map((o: any) => [o.id, o.valid])).toEqual([["op1", true], ["op2", false], ["op3", false], ["op4", false]]);
    expect(plan.ops[3].error).toMatch(/transcript/);
    expect(plan.preview).toMatchObject({ beforeSeconds: 20, afterSeconds: 18, opsValid: 1, opsInvalid: 3 });
    expect(m.ReelTimeline.rows).toHaveLength(1); // proposing changed nothing
    await expect(planning.approvePlan(P(), pid, String(plan._id), ["op2"])).rejects.toThrow(/invalid/);
    const ok = await planning.approvePlan(P(), pid, String(plan._id));
    expect(ok.ops.filter((o: any) => o.approved).map((o: any) => o.id)).toEqual(["op1"]);
  });
  it("story selection becomes deterministic remove_range ops and ids are server-assigned", async () => {
    const { pid, aid } = await setup(); await seedTranscript(aid, pid);
    const plan = await planning.createPlan(P(), pid, "reel", { model: scripted({ summary: "Keep the key point only", storySelection: { hookPhraseId: "p3", keepPhraseIds: ["p3"], rationale: "states the key point directly" }, ops: [] }) });
    expect(plan.ops.every((o: any) => o.op === "remove_range" && o.source === "story_skill" && o.valid)).toBe(true);
    expect(plan.preview.afterSeconds).toBeLessThan(3);
    const bad = planning.createPlan(P(), pid, "reel", { model: scripted({ summary: "nonsense phrase ids", storySelection: { hookPhraseId: "p99", keepPhraseIds: ["p99"], rationale: "does not exist at all" }, ops: [] }) });
    await expect(bad).rejects.toThrow(/Rejected story selection/);
  });
  it("re-asks on invalid model output, then gives up with 502", async () => {
    const { pid } = await setup();
    const ok = scripted(() => (ok.calls === 1 ? "garbage" : { summary: "second try works", ops: [] }));
    const plan = await planning.createPlan(P(), pid, "anything", { model: ok });
    expect(ok.calls).toBe(2); expect(plan.ops).toEqual([]);
    const never = scripted("garbage");
    await expect(planning.createPlan(P(), pid, "anything", { model: never })).rejects.toThrow(/invalid output/);
    expect(never.calls).toBe(3);
  });
  it("execute needs approval; creates ONE version for the whole plan; is idempotent", async () => {
    const { pid } = await setup();
    const plan = await planning.createPlan(P(), pid, "cut", { model: scripted({ summary: "Cut two ranges", ops: [{ op: "remove_range", args: { from: 10, to: 12 }, rationale: "first cut here" }, { op: "remove_range", args: { from: 1, to: 2 }, rationale: "second cut here" }] }) });
    const id = String(plan._id);
    await expect(planning.executePlan(P(), pid, id)).rejects.toThrow(/Approve the plan/);
    await planning.approvePlan(P(), pid, id);
    const a = await planning.executePlan(P(), pid, id);
    const b = await planning.executePlan(P(), pid, id);
    expect([a.status, a.resultVersion, b.resultVersion]).toEqual(["executed", 2, 2]);
    expect(m.ReelTimeline.rows.map((r: any) => r.version)).toEqual([1, 2]); // not 3: second call did nothing
    expect(m.ReelTimeline.rows[1].doc.parent).toBe(1);
    expect(m.ReelTimeline.rows[0].doc.tracks[0].clips[0].duration).toBeCloseTo(20, 0); // v1 untouched
    expect(a.history.map((h: any) => h.event)).toEqual(["proposed", "approved", "executed"]);
  });
  it("version conflict: plan on a stale base is superseded and cannot run", async () => {
    const { pid } = await setup();
    const model = scripted({ summary: "Cut a bit", ops: [{ op: "remove_range", args: { from: 1, to: 2 }, rationale: "first cut here" }] });
    const plan = await planning.createPlan(P(), pid, "cut", { model });
    const id = String(plan._id);
    await planning.approvePlan(P(), pid, id);
    await request(app).post(`/v1/reel/projects/${pid}/edits`).set(as("owner")).send({ op: "remove_range", args: { from: 5, to: 6 } }); // someone edits meanwhile
    await expect(planning.executePlan(P(), pid, id)).rejects.toThrow(/moved on/);
    expect((await planning.getPlan(P(), pid, id)).status).toBe("superseded");
    const second = await planning.createPlan(P(), pid, "cut", { model });
    await expect(planning.approvePlan(P(), pid, String(second._id))).resolves.toBeTruthy(); // fresh plan on v2 is fine
  });
  it("rejection is recorded and final", async () => {
    const { pid } = await setup();
    const plan = await planning.createPlan(P(), pid, "cut", { model: scripted({ summary: "Cut a bit", ops: [{ op: "remove_range", args: { from: 1, to: 2 }, rationale: "first cut here" }] }) });
    const r = await planning.rejectPlan(P(), pid, String(plan._id), "too aggressive");
    expect([r.status, r.rejectionReason]).toEqual(["rejected", "too aggressive"]);
    await expect(planning.approvePlan(P(), pid, String(plan._id))).rejects.toThrow(/proposed/);
    await expect(planning.executePlan(P(), pid, String(plan._id))).rejects.toThrow(/Approve/);
  });
  it("idempotency key returns the same plan without calling the model again", async () => {
    const { pid } = await setup();
    const model = scripted({ summary: "Nothing to do here", ops: [] });
    const a = await planning.createPlan(P(), pid, "x y z", { model, idempotencyKey: "k1" });
    const b = await planning.createPlan(P(), pid, "x y z", { model, idempotencyKey: "k1" });
    expect([String(a._id) === String(b._id), model.calls]).toEqual([true, 1]);
  });
  it("another user cannot see or touch plans", async () => {
    const { pid } = await setup();
    const plan = await planning.createPlan(P(), pid, "cut", { model: scripted({ summary: "Nothing to do", ops: [] }) });
    await expect(planning.getPlan(P("mallory"), pid, String(plan._id))).rejects.toThrow(/not found/i);
    await expect(planning.executePlan(P("mallory"), pid, String(plan._id))).rejects.toThrow(/not found/i);
  });
});

describe.skipIf(!process.env.GEMINI_API_KEY)("live Gemini planner", () => {
  it("returns a plan that passes the real validation layer", async () => {
    const { pid } = await setup();
    const plan = await planning.createPlan(P(), pid, "Make this a tight vertical reel of about 10 seconds", { preferences: { targetSeconds: 10 } });
    expect(plan.ops.every((o: any) => typeof o.valid === "boolean")).toBe(true);
    expect(plan.model.provider).toBe("gemini");
  }, 120000);
});
