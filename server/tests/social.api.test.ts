// HTTP-level tests of publishing: authorization, preconditions, OAuth callback, signed media.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const m = await vi.hoisted(async () => {
  const { createFakeModel } = await import("./helpers/fakeModel");
  return {
    Project: createFakeModel({ status: "approved", currentVersion: 1, editors: [] }),
    ProjectVersion: createFakeModel(),
    ReviewComment: createFakeModel(),
    ReviewLink: createFakeModel({ revoked: false }),
    Approval: createFakeModel(),
    PublishKit: createFakeModel({ status: "ready", chosenThumbnail: 0 }),
    Channel: createFakeModel(),
    SocialAccount: createFakeModel({ needsReconnect: false }) as any,
    Publication: createFakeModel({ status: "queued" }),
  };
});
vi.mock("../models/review.model", () => ({
  Project: m.Project, ProjectVersion: m.ProjectVersion, ReviewComment: m.ReviewComment, ReviewLink: m.ReviewLink, Approval: m.Approval,
}));
vi.mock("../models/publishkit.model", () => ({ PublishKit: m.PublishKit, Channel: m.Channel }));
vi.mock("../models/social.model", () => ({ SocialAccount: m.SocialAccount, Publication: m.Publication }));
vi.mock("../utils/notify", () => ({ notifyProject: vi.fn() }));
const enqueue = vi.hoisted(() => vi.fn());
vi.mock("../jobs/publish", () => ({ enqueuePublish: enqueue }));
const exchange = vi.hoisted(() => vi.fn());
vi.mock("../utils/youtube", () => ({ authUrl: (s: string) => `https://accounts.example/auth?state=${s}`, exchangeCode: exchange }));
vi.mock("../utils/instagram", () => ({ authUrl: (s: string) => `https://fb.example/auth?state=${s}`, exchangeCode: vi.fn() }));
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

import socialRouter from "../routes/social.route";
import reviewRouter from "../routes/review.route";
import { signGuestToken } from "../utils/reviewTokens";
import { signState, signMedia, decrypt } from "../services/publishLogic";
import { ErrorMiddleware } from "../middleware/error";

const app = express();
app.use(express.json());
app.use("/v1/", reviewRouter);
app.use("/v1/", socialRouter);
app.use(ErrorMiddleware);

let owner = "";
let seq = 0;
let pid = "";
let accId = "";
const as = (id: string) => ({ "x-user": id === "owner" ? owner : id });
const pub = (body: any = {}, who = "owner") =>
  request(app).post(`/v1/projects/${pid}/publish`).set(as(who)).send({ provider: "youtube", accountId: accId, ...body });
const later = (min: number) => new Date(Date.now() + min * 60000).toISOString();

beforeEach(async () => {
  for (const model of Object.values(m)) (model as any).rows.length = 0;
  enqueue.mockReset().mockResolvedValue(undefined);
  owner = `owner${++seq}`;
  const p = await m.Project.create({ title: "Vid", owner, editors: ["editor"] });
  pid = String(p._id);
  await m.ProjectVersion.create({ project: pid, number: 1, kind: "upload", processing: "ready", duration: 60, sourceKey: "projects/x/v1/source.mp4" });
  await m.PublishKit.create({ project: pid, version: "v", titles: ["a", "b", "c"], description: "d" });
  const a = await m.SocialAccount.create({ user: owner, provider: "youtube", externalId: "ch1", name: "My Channel", accessToken: "enc" });
  accId = String(a._id);
});

describe("authorization", () => {
  it("401 anonymous, 404 stranger, 403 editor and guest", async () => {
    expect((await request(app).post(`/v1/projects/${pid}/publish`).send({})).status).toBe(401);
    expect((await pub({}, "stranger")).status).toBe(404);
    expect((await pub({}, "editor")).status).toBe(403);
    const t = signGuestToken({ pid, lid: "l", name: "G" } as any);
    expect((await request(app).get(`/v1/projects/${pid}/publications`).set("x-guest-token", t)).status).toBe(403);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("cannot publish with someone else's account", async () => {
    const theirs = await m.SocialAccount.create({ user: "other", provider: "youtube", externalId: "x", accessToken: "e" });
    expect((await pub({ accountId: String(theirs._id) })).status).toBe(404);
  });
  it("accounts list never exposes tokens and is per-user", async () => {
    await m.SocialAccount.create({ user: "other", provider: "youtube", externalId: "y", name: "Theirs", accessToken: "e" });
    const r = await request(app).get("/v1/social/accounts").set(as("owner"));
    expect(r.body.accounts).toHaveLength(1);
    expect(JSON.stringify(r.body)).not.toMatch(/accessToken|enc/);
  });
  it("disconnect only own account", async () => {
    m.SocialAccount.deleteOne = vi.fn(async (q: any) => {
      const i = m.SocialAccount.rows.findIndex((r: any) => String(r._id) === String(q._id) && r.user === q.user);
      if (i >= 0) m.SocialAccount.rows.splice(i, 1);
      return { deletedCount: i >= 0 ? 1 : 0 };
    });
    expect((await request(app).delete(`/v1/social/accounts/${accId}`).set(as("other"))).status).toBe(404);
    expect((await request(app).delete(`/v1/social/accounts/${accId}`).set(as("owner"))).status).toBe(200);
  });
});

describe("preconditions", () => {
  it("refuses before approval", async () => {
    await m.Project.updateOne({ _id: pid }, { status: "in_review" });
    expect((await pub()).status).toBe(409);
  });
  it("refuses without a ready kit", async () => {
    m.PublishKit.rows[0].status = "running";
    expect((await pub()).status).toBe(409);
  });
  it("refuses accounts needing reconnect", async () => {
    m.SocialAccount.rows[0].needsReconnect = true;
    expect((await pub()).status).toBe(409);
  });
  it("validates schedule and body", async () => {
    expect((await pub({ scheduledAt: later(5) })).status).toBe(422);
    expect((await pub({ provider: "tiktok" })).status).toBe(422);
    expect((await pub({ extra: 1 })).status).toBe(422);
  });
  it("account provider must match", async () => {
    expect((await pub({ provider: "instagram" })).status).toBe(404);
  });
});

describe("publishing", () => {
  it("queues now for YouTube with no delay", async () => {
    const r = await pub({ privacy: "unlisted" });
    expect(r.status).toBe(202);
    expect(enqueue).toHaveBeenCalledWith(expect.any(String), 0);
    expect(r.body.publication.privacy).toBe("unlisted");
  });
  it("blocks duplicates, allows retry after failure", async () => {
    expect((await pub()).status).toBe(202);
    expect((await pub()).status).toBe(409);
    m.Publication.rows[0].status = "failed";
    expect((await pub()).status).toBe(202);
  });
  it("Instagram schedule becomes a delayed job", async () => {
    const ig = await m.SocialAccount.create({ user: owner, provider: "instagram", externalId: "ig1", accessToken: "e" });
    const r = await pub({ provider: "instagram", accountId: String(ig._id), scheduledAt: later(60) });
    expect(r.status).toBe(202);
    expect(enqueue.mock.calls[0][1]).toBeGreaterThan(50 * 60000);
  });
  it("marks failed when the queue is down", async () => {
    enqueue.mockRejectedValue(new Error("down"));
    expect((await pub()).status).toBe(503);
    expect(m.Publication.rows[0].status).toBe("failed");
  });
});

describe("oauth", () => {
  const cb = (q: string) => request(app).get(`/v1/social/youtube/callback?${q}`);
  it("connect returns a consent URL carrying signed state", async () => {
    const r = await request(app).post("/v1/social/youtube/connect").set(as("owner"));
    expect(r.body.url).toMatch(/state=.+\./);
    expect((await request(app).post("/v1/social/tiktok/connect").set(as("owner"))).status).toBe(404);
    expect((await request(app).post("/v1/social/youtube/connect")).status).toBe(401);
  });
  it("rejects bad or foreign-provider state without calling the provider", async () => {
    expect((await cb("code=c&state=bad")).headers.location).toMatch(/social_error=invalid_state/);
    expect((await cb(`code=c&state=${signState("u", "instagram")}`)).headers.location).toMatch(/invalid_state/);
    expect(exchange).not.toHaveBeenCalled();
  });
  it("stores encrypted tokens for the state's user", async () => {
    exchange.mockResolvedValue({ access_token: "AT", refresh_token: "RT", expires_in: 3600, externalId: "chX", name: "Chan" });
    const upsert = vi.fn();
    m.SocialAccount.updateOne = upsert;
    const r = await cb(`code=c&state=${signState("userA", "youtube")}`);
    expect(r.headers.location).toMatch(/connected=youtube/);
    const [q, set, opts] = upsert.mock.calls[0];
    expect(q).toMatchObject({ user: "userA", provider: "youtube", externalId: "chX" });
    expect(set.accessToken).not.toContain("AT");
    expect(decrypt(set.accessToken)).toBe("AT");
    expect(decrypt(set.refreshToken)).toBe("RT");
    expect(opts).toEqual({ upsert: true });
  });
  it("reports provider errors by redirect, not a 500", async () => {
    exchange.mockRejectedValue(new Error("boom"));
    expect((await cb(`code=c&state=${signState("u", "youtube")}`)).headers.location).toMatch(/social_error=boom/);
    expect((await cb(`state=${signState("u", "youtube")}`)).headers.location).toMatch(/denied/);
  });
});

describe("public media", () => {
  it("403 without a valid token for that publication and kind", async () => {
    const p = await m.Publication.create({ project: pid, provider: "instagram" });
    const id = String(p._id);
    expect((await request(app).get(`/v1/public-media/${id}/video`)).status).toBe(403);
    expect((await request(app).get(`/v1/public-media/${id}/video?t=${signMedia(id, "cover")}`)).status).toBe(403);
    expect((await request(app).get(`/v1/public-media/${id}/video?t=${signMedia("other", "video")}`)).status).toBe(403);
    expect((await request(app).get(`/v1/public-media/${id}/source?t=${signMedia(id, "video")}`)).status).toBe(403);
  });
  it("404 for a valid token on a YouTube publication", async () => {
    const p = await m.Publication.create({ project: pid, provider: "youtube" });
    const id = String(p._id);
    expect((await request(app).get(`/v1/public-media/${id}/video?t=${signMedia(id, "video")}`)).status).toBe(404);
  });
});
