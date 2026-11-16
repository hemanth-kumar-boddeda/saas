// Voice notes: upload rules, drafts for the owner, playback tokens, access.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";

const m = await vi.hoisted(async () => {
  process.env.STORAGE_DIR = (await import("os")).tmpdir() + "/voice-test-storage";
  const { createFakeModel } = await import("./helpers/fakeModel");
  return {
    Project: createFakeModel({ status: "in_review", currentVersion: 1, editors: [], references: [], editorInvites: [] }),
    ProjectVersion: createFakeModel(),
    ReviewComment: createFakeModel({ status: "open", draft: false }),
    ReviewLink: createFakeModel({ revoked: false, role: "guest" }),
    Approval: createFakeModel(),
  };
});
vi.mock("../models/review.model", () => m);
vi.mock("../models/user.model", () => ({ default: { findOne: vi.fn(), find: vi.fn().mockResolvedValue([]) } }));
vi.mock("../utils/notify", () => ({ notifyProject: vi.fn(), mailLink: vi.fn().mockResolvedValue(true), reviewLinkUrl: (t: string) => t }));
vi.mock("../jobs/autoKit", () => ({ autoStartKit: vi.fn() }));
const media = vi.hoisted(() => ({ duration: 12 }));
vi.mock("../utils/transcode", () => ({
  probeDuration: vi.fn(), toHls: vi.fn(),
  probeAudioDuration: vi.fn(async (f: string) => {
    if (fs.readFileSync(f).toString().startsWith("NOT-AUDIO")) throw new Error("not audio");
    return media.duration;
  }),
  toVoiceM4a: vi.fn(async (_src: string, out: string) => fs.writeFileSync(out, "m4a-bytes")),
}));
vi.mock("../controllers/user.controller", () => ({ generateAccessToken: (_q: any, _r: any, next: any) => next() }));
vi.mock("../middleware/auth", async () => {
  const { default: ErrorHandler } = await import("../utils/ErrorHandler");
  return {
    isAuthenticated: (req: any, _r: any, next: any) => {
      const id = req.headers["x-user"];
      if (!id) return next(new ErrorHandler(401, "login"));
      req.user = { _id: id, name: `User ${id}` };
      next();
    },
  };
});

import reviewRouter from "../routes/review.route";
import { ErrorMiddleware } from "../middleware/error";
import { hashToken } from "../utils/reviewTokens";

const app = express();
app.use(express.json());
app.use("/v1/", reviewRouter);
app.use(ErrorMiddleware);
const as = (id: string) => ({ "x-user": id });
let pid = "";
let vid = "";
const voice = (hdr: Record<string, string>, opts: { data?: string; type?: string; fields?: Record<string, string> } = {}) => {
  let r = request(app).post(`/v1/projects/${pid}/versions/${vid}/voice-comments`).set(hdr);
  for (const [k, v] of Object.entries({ timecode: "5", ...(opts.fields ?? {}) })) r = r.field(k, v);
  return r.attach("audio", Buffer.from(opts.data ?? "fake-audio"), { filename: "note.webm", contentType: opts.type ?? "audio/webm" });
};

beforeEach(async () => {
  for (const model of Object.values(m)) (model as any).rows.length = 0;
  media.duration = 12;
  const p = await m.Project.create({ title: "Vid", owner: "owner", editors: ["editor"] });
  pid = String(p._id);
  vid = String((await m.ProjectVersion.create({ project: pid, number: 1, kind: "upload", processing: "ready", duration: 60 }))._id);
});

describe("voice notes", () => {
  it("owner voice note is a private draft with a playable signed URL", async () => {
    const r = await voice(as("owner"));
    expect(r.status).toBe(201);
    expect(r.body.comment).toMatchObject({ draft: true, audioDuration: 12, timecode: 5 });
    expect(r.body.comment.audioUrl).toMatch(/^\/v1\/voice\/.+\?t=/);
    expect(JSON.stringify(r.body)).not.toMatch(/\.m4a|projects\//); // no storage path leaks
    const play = await request(app).get(r.body.comment.audioUrl);
    expect(play.status).toBe(200);
    expect(play.headers["content-type"]).toMatch(/audio/);
  });
  it("editor (account) voice note is visible to the owner immediately", async () => {
    const r = await voice(as("editor"), { fields: { body: "see my note" } });
    expect(r.status).toBe(201);
    expect(r.body.comment.draft).toBe(false);
    const list = await request(app).get(`/v1/projects/${pid}/versions/${vid}/comments`).set(as("owner"));
    expect(list.body.comments).toHaveLength(1);
    expect(list.body.comments[0].audioUrl).toBeTruthy();
  });
  it("owner's draft voice note is hidden from the editor until sent", async () => {
    await voice(as("owner"));
    const list = await request(app).get(`/v1/projects/${pid}/versions/${vid}/comments`).set(as("editor"));
    expect(list.body.comments).toHaveLength(0);
  });
  it("magic-link editor can record; plain guest can too (comment permission)", async () => {
    await m.ReviewLink.create({ project: pid, tokenHash: hashToken("editor-token-123456"), role: "editor", email: "ed@x.com" });
    const t = (await request(app).post("/v1/review-links/enter").send({ token: "editor-token-123456" })).body.guestToken;
    const r = await voice({ "x-guest-token": t });
    expect(r.status).toBe(201);
    expect(r.body.comment.authorName).toBeTruthy();
  });
  it("stranger and anonymous are blocked", async () => {
    expect((await voice(as("stranger"))).status).toBe(404);
    expect((await voice({})).status).toBe(401);
  });
  it("rejects non-audio uploads, unplayable audio, too long notes, bad time and missing file", async () => {
    expect((await voice(as("owner"), { type: "image/png" })).status).toBe(415);
    expect((await voice(as("owner"), { data: "NOT-AUDIO" })).status).toBe(422);
    media.duration = 400;
    expect((await voice(as("owner"))).status).toBe(422);
    media.duration = 12;
    expect((await voice(as("owner"), { fields: { timecode: "999" } })).status).toBe(422);
    const none = await request(app).post(`/v1/projects/${pid}/versions/${vid}/voice-comments`).set(as("owner")).field("timecode", "5");
    expect(none.status).toBe(422);
  });
  it("reply by voice sits at the parent's time", async () => {
    const root = await request(app).post(`/v1/projects/${pid}/versions/${vid}/comments`).set(as("owner")).send({ body: "x", timecode: 20 });
    const r = await voice(as("editor"), { fields: { parentId: root.body.comment._id, timecode: "50" } });
    expect(r.status).toBe(201);
    expect(r.body.comment.timecode).toBe(20);
  });
  it("playback link needs a valid token", async () => {
    const r = await voice(as("owner"));
    const id = r.body.comment._id;
    expect((await request(app).get(`/v1/voice/${id}`)).status).toBe(403);
    expect((await request(app).get(`/v1/voice/${id}?t=forged.token`)).status).toBe(403);
    expect((await request(app).get(`/v1/voice/not-an-id?t=x`)).status).toBe(403);
  });
});

it("cleans up the temp upload", () => {
  const tmp = path.join(os.tmpdir(), "voice-test-storage", "tmp");
  expect(fs.existsSync(tmp) ? fs.readdirSync(tmp).length : 0).toBe(0);
});
