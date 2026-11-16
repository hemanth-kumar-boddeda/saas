// HTTP-level tests of the publish-kit API: authorization, preconditions, editing,
// channel profiles, rate limit. DB, auth and the queue are faked; real middleware/controllers run.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const m = await vi.hoisted(async () => {
  process.env.AI_RATE_LIMIT_PER_HOUR = "2";
  const { createFakeModel } = await import("./helpers/fakeModel");
  return {
    Project: createFakeModel({ status: "approved", currentVersion: 1, editors: [] }),
    ProjectVersion: createFakeModel(),
    ReviewComment: createFakeModel(),
    ReviewLink: createFakeModel({ revoked: false }),
    Approval: createFakeModel(),
    PublishKit: createFakeModel({ status: "queued" }),
    Channel: createFakeModel(),
  };
});
vi.mock("../models/review.model", () => ({
  Project: m.Project, ProjectVersion: m.ProjectVersion, ReviewComment: m.ReviewComment, ReviewLink: m.ReviewLink, Approval: m.Approval,
}));
vi.mock("../models/publishkit.model", () => ({ PublishKit: m.PublishKit, Channel: m.Channel }));
vi.mock("../utils/notify", () => ({ notifyProject: vi.fn() }));
const enqueue = vi.hoisted(() => vi.fn());
vi.mock("../jobs/publishKit", () => ({ enqueueKit: enqueue }));
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

import kitRouter from "../routes/publishkit.route";
import reviewRouter from "../routes/review.route";
import { signGuestToken } from "../utils/reviewTokens";
import { ErrorMiddleware } from "../middleware/error";

const app = express();
app.use(express.json());
app.use("/v1/", reviewRouter);
app.use("/v1/", kitRouter);
app.use(ErrorMiddleware);

// Each test gets its own owner id so the per-user AI rate-limit budget is not shared.
let ownerId = "";
let seq = 0;
const as = (id: string) => ({ "x-user": id === "owner" ? ownerId : id });
let pid: string;
const startAs = (who: string) => request(app).post(`/v1/projects/${pid}/kit`).set(as(who));
const readyKit = (extra: any = {}) =>
  m.PublishKit.create({ project: pid, version: "v", status: "ready", titles: ["a", "b", "c"], description: "d", srt: "1\n", thumbnails: [], ...extra });

beforeEach(async () => {
  for (const model of Object.values(m)) model.rows.length = 0;
  enqueue.mockReset().mockResolvedValue(undefined);
  ownerId = `owner${++seq}`;
  const p = await m.Project.create({ title: "Vid", owner: ownerId, editors: ["editor"] });
  pid = String(p._id);
  await m.ProjectVersion.create({ project: pid, number: 1, kind: "upload", processing: "ready", duration: 60 });
});

describe("kit authorization", () => {
  it("401 anonymous, 404 stranger on every kit route", async () => {
    for (const [method, url] of [["post", ""], ["get", ""], ["patch", ""], ["get", "/srt"], ["get", "/thumbnails/0"]] as const) {
      expect((await (request(app) as any)[method](`/v1/projects/${pid}/kit${url}`)).status).toBe(401);
      expect((await (request(app) as any)[method](`/v1/projects/${pid}/kit${url}`).set(as("stranger"))).status).toBe(404);
    }
  });
  it("guests are blocked from AI output", async () => {
    const t = signGuestToken({ pid, lid: "l1", name: "Gina" } as any);
    const r = await request(app).get(`/v1/projects/${pid}/kit`).set("x-guest-token", t);
    expect(r.status).toBe(403);
  });
  it("editor can read but not start or edit", async () => {
    await readyKit();
    expect((await request(app).get(`/v1/projects/${pid}/kit`).set(as("editor"))).status).toBe(200);
    expect((await startAs("editor")).status).toBe(403);
    expect((await request(app).patch(`/v1/projects/${pid}/kit`).set(as("editor")).send({ description: "x" })).status).toBe(403);
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("starting a kit", () => {
  it("refuses until approved", async () => {
    await m.Project.updateOne({ _id: pid }, { status: "in_review" });
    expect((await startAs("owner")).status).toBe(409);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("refuses link-only versions and unready uploads", async () => {
    m.ProjectVersion.rows[0].kind = "link";
    expect((await startAs("owner")).status).toBe(409);
    m.ProjectVersion.rows[0].kind = "upload";
    m.ProjectVersion.rows[0].processing = "pending";
    expect((await startAs("owner")).status).toBe(409);
  });
  it("queues once, then refuses while one is active", async () => {
    const r = await startAs("owner");
    expect(r.status).toBe(202);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect((await startAs("owner")).status).toBe(409);
  });
  it("marks the kit failed when the queue is down", async () => {
    enqueue.mockRejectedValue(new Error("redis down"));
    expect((await startAs("owner")).status).toBe(503);
    expect(m.PublishKit.rows[0].status).toBe("failed");
  });
  it("rate-limits AI starts per user", async () => {
    await m.Project.updateOne({ _id: pid }, { status: "in_review" });
    expect((await startAs("burst")).status).toBe(404); // not a member; limiter sits after access, so no budget used
    const codes = [] as number[];
    for (let i = 0; i < 3; i++) codes.push((await startAs("owner")).status);
    expect(codes.slice(-1)[0]).toBe(429);
  });
});

describe("editing", () => {
  const patch = (body: any, who = "owner") => request(app).patch(`/v1/projects/${pid}/kit`).set(as(who)).send(body);
  it("409 when nothing is ready", async () => {
    await m.PublishKit.create({ project: pid, version: "v", status: "running" });
    expect((await patch({ description: "x" })).status).toBe(409);
  });
  it("validates and saves edits", async () => {
    await readyKit();
    expect((await patch({ titles: ["only one"] })).status).toBe(422);
    expect((await patch({ chosenThumbnail: 7 })).status).toBe(422);
    const r = await patch({ description: "Mine", hashtags: ["#x"], chosenTitle: 2 });
    expect(r.status).toBe(200);
    expect(r.body.kit.description).toBe("Mine");
    expect(r.body.kit.edited).toBe(true);
  });
  it("never exposes storage keys", async () => {
    await readyKit({ thumbnails: [{ key: "projects/secret/thumb.jpg", label: "L", text: "T", score: 80 }] });
    const r = await request(app).get(`/v1/projects/${pid}/kit`).set(as("owner"));
    expect(JSON.stringify(r.body)).not.toMatch(/secret/);
    expect(r.body.kit.thumbnails[0].url).toMatch(/thumbnails\/0$/);
  });
  it("serves SRT as an attachment", async () => {
    await readyKit();
    const r = await request(app).get(`/v1/projects/${pid}/kit/srt`).set(as("owner"));
    expect(r.headers["content-disposition"]).toMatch(/attachment/);
  });
});

describe("channel profiles", () => {
  const body = { name: "Tech", niche: "gadgets", tone: "witty", brand: { primary: "#000000", secondary: "#ffffff", accent: "#ff0000" } };
  it("creates, validates and lists only my channels", async () => {
    expect((await request(app).post("/v1/channels").set(as("owner")).send({ ...body, brand: { ...body.brand, accent: "red" } })).status).toBe(422);
    expect((await request(app).post("/v1/channels").set(as("owner")).send(body)).status).toBe(201);
    await request(app).post("/v1/channels").set(as("other")).send({ ...body, name: "Theirs" });
    const r = await request(app).get("/v1/channels").set(as("owner"));
    expect(r.body.channels.map((c: any) => c.name)).toEqual(["Tech"]);
  });
  it("cannot edit or attach someone else's channel", async () => {
    const theirs = await m.Channel.create({ ...body, owner: "other" });
    expect((await request(app).patch(`/v1/channels/${theirs._id}`).set(as("owner")).send(body)).status).toBe(404);
    expect((await request(app).put(`/v1/projects/${pid}/channel`).set(as("owner")).send({ channelId: String(theirs._id) })).status).toBe(404);
  });
  it("owner attaches own channel; editor cannot", async () => {
    const mine = await m.Channel.create({ ...body, owner: ownerId });
    expect((await request(app).put(`/v1/projects/${pid}/channel`).set(as("editor")).send({ channelId: String(mine._id) })).status).toBe(403);
    expect((await request(app).put(`/v1/projects/${pid}/channel`).set(as("owner")).send({ channelId: String(mine._id) })).status).toBe(200);
    expect(String(m.Project.rows[0].channel)).toBe(String(mine._id));
  });
});
