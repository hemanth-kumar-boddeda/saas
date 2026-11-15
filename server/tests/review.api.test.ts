// HTTP-level tests of the review API: authorization, comments, versions,
// approval log, guest links. Auth middleware and DB are faked; the real
// projectAccess middleware, controllers and rules run.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const m = await vi.hoisted(async () => {
  const { createFakeModel } = await import("./helpers/fakeModel");
  return {
    Project: createFakeModel({ status: "in_review", currentVersion: 0, editors: [] }),
    ProjectVersion: createFakeModel(),
    ReviewComment: createFakeModel({ status: "open" }),
    ReviewLink: createFakeModel({ revoked: false }),
    Approval: createFakeModel(),
  };
});
vi.mock("../models/review.model", () => m);
vi.mock("../models/user.model", () => ({ default: { findOne: vi.fn(), find: vi.fn().mockResolvedValue([]) } }));
vi.mock("../utils/notify", () => ({ notifyProject: vi.fn() }));
// Fake session auth: header x-user = user id.
vi.mock("../controllers/user.controller", () => ({
  generateAccessToken: (_q: any, _r: any, next: any) => next(),
}));
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

const as = (id: string) => ({ "x-user": id });
let pid: string;
let vid: string;

beforeEach(async () => {
  for (const model of Object.values(m)) model.rows.length = 0;
  const p = await m.Project.create({ title: "Vid", owner: "owner", editors: ["editor"], currentVersion: 1 });
  pid = String(p._id);
  const v = await m.ProjectVersion.create({ project: pid, number: 1, kind: "link", processing: "ready", duration: 60 });
  vid = String(v._id);
});

describe("project access", () => {
  it("401 without login", async () => {
    expect((await request(app).get(`/v1/projects/${pid}`)).status).toBe(401);
  });
  it("404 (not 403) for a stranger: no existence leak", async () => {
    expect((await request(app).get(`/v1/projects/${pid}`).set(as("stranger"))).status).toBe(404);
  });
  it("owner and editor can read", async () => {
    expect((await request(app).get(`/v1/projects/${pid}`).set(as("owner"))).body.project.role).toBe("owner");
    expect((await request(app).get(`/v1/projects/${pid}`).set(as("editor"))).body.project.role).toBe("editor");
  });
  it("lists only my projects", async () => {
    await m.Project.create({ title: "Other", owner: "x", editors: [] });
    const r = await request(app).get("/v1/projects").set(as("owner"));
    expect(r.body.projects).toHaveLength(1);
  });
});

describe("comments", () => {
  const post = (who: string, body: any, v = vid) =>
    request(app).post(`/v1/projects/${pid}/versions/${v}/comments`).set(as(who)).send(body);

  it("adds, replies at parent timecode, rejects nesting and bad time", async () => {
    const root = await post("owner", { body: "cut here", timecode: 12.5 });
    expect(root.status).toBe(201);
    const reply = await post("editor", { body: "done", timecode: 40, parentId: root.body.comment._id });
    expect(reply.status).toBe(201);
    expect(reply.body.comment.timecode).toBe(12.5);
    expect((await post("owner", { body: "x", timecode: 1, parentId: reply.body.comment._id })).status).toBe(422);
    expect((await post("owner", { body: "x", timecode: 999 })).status).toBe(422);
    expect((await post("owner", { body: "", timecode: 1 })).status).toBe(422);
  });
  it("stranger cannot comment", async () => {
    expect((await post("stranger", { body: "hi", timecode: 1 })).status).toBe(404);
  });
  it("resolve/filter by status; comments stay with their version", async () => {
    const c = await post("owner", { body: "a", timecode: 1 });
    await post("owner", { body: "b", timecode: 2 });
    const res = await request(app).patch(`/v1/projects/${pid}/comments/${c.body.comment._id}/status`).set(as("editor")).send({ status: "resolved" });
    expect(res.status).toBe(200);
    const open = await request(app).get(`/v1/projects/${pid}/versions/${vid}/comments?status=open`).set(as("owner"));
    expect(open.body.comments.map((x: any) => x.body)).toEqual(["b"]);
    const v2 = await m.ProjectVersion.create({ project: pid, number: 2, kind: "link", duration: 60 });
    const other = await request(app).get(`/v1/projects/${pid}/versions/${v2._id}/comments`).set(as("owner"));
    expect(other.body.comments).toHaveLength(0);
  });
});

describe("approval", () => {
  const decide = (who: string, action: string, version = vid) =>
    request(app).post(`/v1/projects/${pid}/approval`).set(as(who)).send({ action, versionId: version });

  it("editor cannot approve; owner can and it is logged", async () => {
    expect((await decide("editor", "approve")).status).toBe(403);
    const ok = await decide("owner", "approve");
    expect(ok.body.status).toBe("approved");
    const log = await request(app).get(`/v1/projects/${pid}/approvals`).set(as("owner"));
    expect(log.body.approvals).toMatchObject([{ action: "approve", versionNumber: 1 }]);
    expect((await decide("owner", "approve")).status).toBe(409);
  });
  it("cannot decide an old version", async () => {
    await m.ProjectVersion.create({ project: pid, number: 2, kind: "link" });
    await m.Project.updateOne({ _id: pid }, { currentVersion: 2 });
    expect((await decide("owner", "approve")).status).toBe(409);
  });
});

describe("guest links", () => {
  const mkLink = async (body: any = {}) =>
    (await request(app).post(`/v1/projects/${pid}/links`).set(as("owner")).send(body)).body.link;

  it("guest enters, comments, cannot approve or resolve or list links", async () => {
    const link = await mkLink();
    const enter = await request(app).post("/v1/review-links/enter").send({ token: link.token, name: "Ann" });
    expect(enter.status).toBe(200);
    const g = { "x-guest-token": enter.body.guestToken };
    const c = await request(app).post(`/v1/projects/${pid}/versions/${vid}/comments`).set(g).send({ body: "nice", timecode: 3 });
    expect(c.status).toBe(201);
    expect(c.body.comment.authorName).toBe("Ann");
    expect((await request(app).post(`/v1/projects/${pid}/approval`).set(g).send({ action: "approve", versionId: vid })).status).toBe(403);
    expect((await request(app).patch(`/v1/projects/${pid}/comments/${c.body.comment._id}/status`).set(g).send({ status: "resolved" })).status).toBe(403);
    expect((await request(app).get(`/v1/projects/${pid}/links`).set(g)).status).toBe(403);
  });
  it("guest token does not open another project", async () => {
    const link = await mkLink();
    const enter = await request(app).post("/v1/review-links/enter").send({ token: link.token, name: "Ann" });
    const other = await m.Project.create({ title: "Other", owner: "x", editors: [] });
    expect((await request(app).get(`/v1/projects/${other._id}`).set({ "x-guest-token": enter.body.guestToken })).status).toBe(401);
  });
  it("password required; wrong/expired/revoked rejected with same message", async () => {
    const pw = await mkLink({ password: "secret1" });
    const bad = await request(app).post("/v1/review-links/enter").send({ token: pw.token, name: "A", password: "nope" });
    const none = await request(app).post("/v1/review-links/enter").send({ token: pw.token, name: "A" });
    const good = await request(app).post("/v1/review-links/enter").send({ token: pw.token, name: "A", password: "secret1" });
    expect([bad.status, none.status, good.status]).toEqual([401, 401, 200]);

    const exp = await mkLink({ expiresInDays: 1 });
    m.ReviewLink.rows.find((r: any) => String(r._id) === String(exp._id)).expiresAt = new Date(Date.now() - 1000);
    expect((await request(app).post("/v1/review-links/enter").send({ token: exp.token, name: "A" })).status).toBe(401);

    const rev = await mkLink();
    await request(app).delete(`/v1/projects/${pid}/links/${rev._id}`).set(as("owner"));
    expect((await request(app).post("/v1/review-links/enter").send({ token: rev.token, name: "A" })).status).toBe(401);
  });
  it("revoking a link kills existing guest sessions", async () => {
    const link = await mkLink();
    const enter = await request(app).post("/v1/review-links/enter").send({ token: link.token, name: "Ann" });
    await request(app).delete(`/v1/projects/${pid}/links/${link._id}`).set(as("owner"));
    expect((await request(app).get(`/v1/projects/${pid}`).set({ "x-guest-token": enter.body.guestToken })).status).toBe(401);
  });
  it("stores only a hash of the token", async () => {
    const link = await mkLink();
    expect(JSON.stringify(m.ReviewLink.rows)).not.toContain(link.token);
  });
});

describe("versions", () => {
  it("link version bumps number, resets status to in_review, keeps old comments", async () => {
    await request(app).post(`/v1/projects/${pid}/versions/${vid}/comments`).set(as("owner")).send({ body: "old", timecode: 1 });
    await m.Project.updateOne({ _id: pid }, { status: "changes_requested" });
    const r = await request(app).post(`/v1/projects/${pid}/versions`).set(as("editor")).send({ externalUrl: "https://youtu.be/abc" });
    expect(r.status).toBe(201);
    expect(r.body.version.number).toBe(2);
    expect(m.Project.rows[0].status).toBe("in_review");
    const old = await request(app).get(`/v1/projects/${pid}/versions/${vid}/comments`).set(as("owner"));
    expect(old.body.comments).toHaveLength(1);
  });
  it("rejects http links, missing source, and published project", async () => {
    const up = (b: any) => request(app).post(`/v1/projects/${pid}/versions`).set(as("owner")).send(b);
    expect((await up({ externalUrl: "http://x.com/a" })).status).toBe(422);
    expect((await up({})).status).toBe(422);
    await m.Project.updateOne({ _id: pid }, { status: "published" });
    expect((await up({ externalUrl: "https://youtu.be/abc" })).status).toBe(409);
  });
  it("stream url requires a ready version and signs a token", async () => {
    const v = await m.ProjectVersion.create({ project: pid, number: 2, kind: "upload", processing: "pending" });
    expect((await request(app).get(`/v1/projects/${pid}/versions/${v._id}/stream-url`).set(as("owner"))).status).toBe(409);
  });
});

describe("stream endpoint", () => {
  it("rejects missing or foreign token", async () => {
    expect((await request(app).get(`/v1/stream/${vid}/index.m3u8`)).status).toBe(403);
    expect((await request(app).get(`/v1/stream/${vid}/..%2f..%2fetc.m3u8?t=x`)).status).toBe(403);
  });
});
