// HTTP tests of /v1/reel: auth (cookie-less token), scopes, ownership, real asset registration with
// real ffmpeg, edits, versioning, approval rules. DB models are in-memory fakes; media work is real.
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
  };
});
vi.mock("../models/review.model", () => ({ Project: m.Project, ProjectVersion: m.ProjectVersion, ReviewComment: m.ReviewComment, ReviewLink: m.ReviewLink, Approval: m.Approval }));
vi.mock("../reel/models", () => ({ MediaAsset: m.MediaAsset, ReelTimeline: m.ReelTimeline, Transcript: m.Transcript, ReelJob: m.ReelJob, ApiToken: m.ApiToken, UsageEvent: m.UsageEvent, JOB_TYPES: [], JOB_STATES: [] }));
vi.mock("../reel/queue", () => ({ enqueueJob: vi.fn() }));
vi.mock("../controllers/user.controller", () => ({ generateAccessToken: (_q: any, _r: any, next: any) => next() }));
vi.mock("../middleware/auth", async () => {
  const { default: ErrorHandler } = await import("../utils/ErrorHandler");
  return { isAuthenticated: (req: any, _r: any, next: any) => { const id = req.headers["x-user"]; if (!id) return next(new ErrorHandler(401, "login")); req.user = { _id: id, name: id }; next(); } };
});
vi.mock("../middleware/rateLimit", () => ({ reelIpLimiter: (_q: any, _r: any, n: any) => n(), reelPlanLimiter: (_q: any, _r: any, n: any) => n() }));

import reelRouter from "../reel/routes";
import { ErrorMiddleware } from "../middleware/error";
import { createApiToken } from "../reel/apiTokens";
import { makeSampleVideo } from "../utils/transcode";

const app = express();
app.use(express.json());
app.use("/v1/", reelRouter);
app.use(ErrorMiddleware);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reelapi-"));
process.env.STORAGE_DIR = path.join(dir, "storage");
const sample = path.join(dir, "s.mp4");
beforeAll(async () => { await makeSampleVideo(sample, "testsrc2", 6); }, 30000);
beforeEach(() => { for (const x of Object.values(m)) x.rows.length = 0; });

const as = (u: string) => ({ "x-user": u });
const mkProject = async (u = "owner") => (await request(app).post("/v1/reel/projects").set(as(u)).send({ title: "T" })).body.project.id as string;
const upload = (pid: string, u = "owner") => request(app).post(`/v1/reel/projects/${pid}/assets`).set(as(u)).attach("video", sample, { contentType: "video/mp4" });

describe("auth and scopes", () => {
  it("401 without credentials, 401 for a bad token", async () => {
    expect((await request(app).get("/v1/reel/capabilities")).status).toBe(401);
    expect((await request(app).get("/v1/reel/capabilities").set("Authorization", "Bearer rf_nope")).status).toBe(401);
  });
  it("token works, is scope-limited, and revocation stops it", async () => {
    const t = await createApiToken("owner", "ci", ["reel:read"]);
    expect((await request(app).get("/v1/reel/capabilities").set("Authorization", `Bearer ${t.raw}`)).status).toBe(200);
    expect((await request(app).post("/v1/reel/projects").set("Authorization", `Bearer ${t.raw}`).send({ title: "x" })).status).toBe(403);
    expect(m.ApiToken.rows[0].tokenHash).not.toContain("rf_");
    expect(JSON.stringify(m.ApiToken.rows)).not.toContain(t.raw);
    m.ApiToken.rows[0].revoked = true;
    expect((await request(app).get("/v1/reel/capabilities").set("Authorization", `Bearer ${t.raw}`)).status).toBe(401);
  });
  it("tokens cannot mint tokens", async () => {
    const t = await createApiToken("owner", "ci", ["reel:read", "reel:write"]);
    expect((await request(app).post("/v1/reel/tokens").set("Authorization", `Bearer ${t.raw}`).send({ name: "x", scopes: ["reel:read"] })).status).toBe(403);
    const ok = await request(app).post("/v1/reel/tokens").set(as("owner")).send({ name: "x", scopes: ["reel:read"] });
    expect(ok.status).toBe(201); expect(ok.body.token).toMatch(/^rf_/);
  });
});

describe("project isolation", () => {
  it("another user gets 404 on every project route", async () => {
    const pid = await mkProject();
    expect((await upload(pid, "mallory")).status).toBe(404);
    expect((await request(app).get(`/v1/reel/projects/${pid}/timeline`).set(as("mallory"))).status).toBe(404);
    expect((await request(app).post(`/v1/reel/projects/${pid}/edits`).set(as("mallory")).send({ op: "remove_range", args: { from: 1, to: 2 } })).status).toBe(404);
  });
});

describe("real asset -> edits -> versions", () => {
  it("probes the upload, builds timeline v1, hides storage keys, edits create new immutable versions", async () => {
    const pid = await mkProject();
    const up = await upload(pid);
    expect(up.status).toBe(201);
    expect(up.body.asset.duration).toBeCloseTo(6, 0);
    expect(up.body.asset.hasAudio).toBe(true);
    const t1 = await request(app).get(`/v1/reel/projects/${pid}/timeline`).set(as("owner"));
    expect(JSON.stringify(t1.body)).not.toContain("storageKey");
    expect(t1.body.version).toBe(1);
    const e = await request(app).post(`/v1/reel/projects/${pid}/edits`).set(as("owner")).send({ op: "remove_range", args: { from: 1, to: 3 }, baseVersion: 1 });
    expect(e.status).toBe(201); expect([e.body.version, e.body.parent]).toEqual([2, 1]);
    // v1 unchanged
    const again = await request(app).get(`/v1/reel/projects/${pid}/timeline?version=1`).set(as("owner"));
    expect(again.body.timeline.tracks[0].clips).toHaveLength(1);
    expect(again.body.timeline.tracks[0].clips[0].duration).toBeCloseTo(6, 0);
    // stale base
    expect((await request(app).post(`/v1/reel/projects/${pid}/edits`).set(as("owner")).send({ op: "remove_range", args: { from: 0, to: 1 }, baseVersion: 1 })).status).toBe(409);
  });
  it("rejects bad args, unknown ops and invalid edits with clear errors", async () => {
    const pid = await mkProject(); await upload(pid);
    const bad = (body: any) => request(app).post(`/v1/reel/projects/${pid}/edits`).set(as("owner")).send(body);
    expect((await bad({ op: "nope" })).status).toBe(400);
    expect((await bad({ op: "split_clip", args: { clipId: "x" } })).status).toBe(422);
    expect((await bad({ op: "remove_range", args: { from: 10, to: 20 } })).status).toBe(422);
  });
  it("rejects non-media uploads and keeps nothing", async () => {
    const pid = await mkProject();
    const f = path.join(dir, "fake.mp4"); fs.writeFileSync(f, "not a video");
    const r = await request(app).post(`/v1/reel/projects/${pid}/assets`).set(as("owner")).attach("video", f, { contentType: "video/mp4" });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(m.MediaAsset.rows).toHaveLength(0);
  });
  it("captions need a transcript; transcribe without a key reports provider-not-configured via the job", async () => {
    const pid = await mkProject(); const a = (await upload(pid)).body.asset;
    const cap = await request(app).post(`/v1/reel/projects/${pid}/edits`).set(as("owner")).send({ op: "add_captions", args: { sourceId: a.id } });
    expect(cap.status).toBe(422); expect(cap.body.message).toMatch(/transcript/);
    const tr = await request(app).post(`/v1/reel/projects/${pid}/transcribe`).set(as("owner")).send({ assetId: a.id, provider: "sarvam" });
    expect(tr.status).toBe(202);
    const { registerReelHandlers } = await import("../reel/handlers");
    const { runJob } = await import("../reel/jobs");
    delete process.env.SARVAM_API_KEY; registerReelHandlers();
    const job: any = await runJob(tr.body.job.id, { Job: m.ReelJob as any });
    expect([job.state, job.providerStatus]).toEqual(["failed", "not_configured"]);
    expect(job.error).toMatch(/SARVAM_API_KEY/);
  });
  it("approval needs a render first", async () => {
    const pid = await mkProject(); await upload(pid);
    expect((await request(app).post(`/v1/reel/projects/${pid}/timelines/1/approve`).set(as("owner"))).status).toBe(409);
  });
});

describe("render job end to end (real ffmpeg)", () => {
  it("silence removal from measured silences, vertical reframe, render job creates a playable ProjectVersion, then approval locks the timeline", async () => {
    const { execFileSync } = await import("child_process");
    const gap = path.join(dir, "gap.mp4");
    // 3s tone, 3s true silence, 3s tone, with video
    execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=9", "-f", "lavfi", "-i", "sine=frequency=300:duration=3", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono:d=3", "-f", "lavfi", "-i", "sine=frequency=500:duration=3",
      "-filter_complex", "[1:a][2:a][3:a]concat=n=3:v=0:a=1[a]", "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", gap], { stdio: "ignore" });
    const pid = await mkProject();
    const up = await request(app).post(`/v1/reel/projects/${pid}/assets`).set(as("owner")).attach("video", gap, { contentType: "video/mp4" });
    expect(up.body.asset.silenceCount).toBeGreaterThanOrEqual(1);
    const sid = up.body.asset.id;
    const e1 = await request(app).post(`/v1/reel/projects/${pid}/edits`).set(as("owner")).send({ op: "remove_silences", args: { sourceId: sid, minSilence: 1, pad: 0.1 } });
    expect(e1.status).toBe(201);
    const dur = e1.body.timeline.tracks[0].clips.reduce((s: number, c: any) => s + c.duration, 0);
    expect(dur).toBeLessThan(7.5); expect(dur).toBeGreaterThan(5.5);
    const e2 = await request(app).post(`/v1/reel/projects/${pid}/edits`).set(as("owner")).send({ op: "reframe_vertical" });
    const ver = e2.body.version;
    const rj = await request(app).post(`/v1/reel/projects/${pid}/renders`).set(as("owner")).send({ version: ver, quality: "preview" });
    expect(rj.status).toBe(202);
    const { registerReelHandlers } = await import("../reel/handlers");
    const { runJob } = await import("../reel/jobs");
    registerReelHandlers();
    const job: any = await runJob(rj.body.job.id, { Job: m.ReelJob as any });
    expect(job.state, job.error).toBe("succeeded");
    expect([job.result.measured.width, job.result.measured.height]).toEqual([1080, 1920]);
    expect(job.result.measured.duration).toBeCloseTo(dur, 0);
    expect(m.ProjectVersion.rows).toHaveLength(1);
    expect(m.ProjectVersion.rows[0].processing).toBe("ready");
    expect(fs.existsSync(path.join(process.env.STORAGE_DIR!, m.ProjectVersion.rows[0].hlsKey, "index.m3u8"))).toBe(true);
    expect(m.UsageEvent.rows.map((u: any) => u.kind)).toContain("render_seconds");
    const ok = await request(app).post(`/v1/reel/projects/${pid}/timelines/${ver}/approve`).set(as("owner"));
    expect(ok.body.approved).toBe(true);
    // editing the approved version forks v+1 and leaves the approved row untouched
    const fork = await request(app).post(`/v1/reel/projects/${pid}/edits`).set(as("owner")).send({ op: "add_text_overlay", args: { text: "hi", start: 0, duration: 1 } });
    expect(fork.body.approved).toBe(false);
    expect(m.ReelTimeline.rows.find((r: any) => r.version === ver).approved).toBe(true);
  }, 120000);
});
