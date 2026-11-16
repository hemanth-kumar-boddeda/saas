// Sample project: one per owner, two versions, seeded notes, cleanup on failure.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import fs from "fs";

const m = await vi.hoisted(async () => {
  process.env.STORAGE_DIR = (await import("os")).tmpdir() + "/sample-test-storage";
  const { createFakeModel } = await import("./helpers/fakeModel");
  return {
    Project: createFakeModel({ status: "in_review", currentVersion: 0, editors: [], references: [], editorInvites: [] }),
    ProjectVersion: createFakeModel({ processing: "pending" }),
    ReviewComment: createFakeModel({ status: "open", draft: false }),
    ReviewLink: createFakeModel(),
    Approval: createFakeModel(),
  };
});
vi.mock("../models/review.model", () => m);
vi.mock("../models/user.model", () => ({ default: { findOne: vi.fn(), find: vi.fn().mockResolvedValue([]) } }));
vi.mock("../utils/notify", () => ({ notifyProject: vi.fn(), mailLink: vi.fn(), reviewLinkUrl: (t: string) => t }));
vi.mock("../jobs/autoKit", () => ({ autoStartKit: vi.fn() }));
const media = vi.hoisted(() => ({ make: vi.fn() }));
vi.mock("../utils/transcode", () => ({
  probeDuration: vi.fn().mockResolvedValue(8), toHls: vi.fn(), probeAudioDuration: vi.fn(), toVoiceM4a: vi.fn(), makeSampleVideo: media.make,
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

const app = express();
app.use(express.json());
app.use("/v1/", reviewRouter);
app.use(ErrorMiddleware);
const make = (who = "u1") => request(app).post("/v1/projects/sample").set("x-user", who);

beforeEach(() => {
  for (const model of Object.values(m)) (model as any).rows.length = 0;
  media.make.mockReset().mockImplementation(async (out: string) => fs.writeFileSync(out, "clip"));
});

describe("sample project", () => {
  it("creates a two-version project with notes, one already done", async () => {
    const r = await make();
    expect(r.status).toBe(201);
    expect(r.body.project).toMatchObject({ title: "Sample: Brand reel", role: "owner", currentVersion: 2 });
    expect(m.ProjectVersion.rows.map((v: any) => v.number)).toEqual([1, 2]);
    expect(media.make).toHaveBeenCalledTimes(2);
    const notes = m.ReviewComment.rows;
    expect(notes).toHaveLength(4);
    expect(notes.filter((c: any) => c.status === "resolved")).toHaveLength(1);
    expect(notes.every((c: any) => !c.draft && c.authorKey === "sample")).toBe(true);
  });
  it("is idempotent: the second call returns the same project", async () => {
    const a = await make();
    const b = await make();
    expect(b.status).toBe(200);
    expect(b.body.project._id).toBe(a.body.project._id);
    expect(m.Project.rows).toHaveLength(1);
    expect(media.make).toHaveBeenCalledTimes(2);
  });
  it("is per user", async () => {
    await make("u1");
    expect((await make("u2")).status).toBe(201);
    expect(m.Project.rows).toHaveLength(2);
  });
  it("needs a login and cleans up when ffmpeg fails", async () => {
    expect((await request(app).post("/v1/projects/sample")).status).toBe(401);
    media.make.mockRejectedValue(new Error("ffmpeg missing"));
    expect((await make()).status).toBeGreaterThanOrEqual(500);
    expect(m.Project.rows).toHaveLength(0);
    expect(m.ProjectVersion.rows).toHaveLength(0);
    expect(m.ReviewComment.rows).toHaveLength(0);
  });
});
