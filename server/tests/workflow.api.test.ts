// Owner -> editor loop: brief, references, editor magic-link invite, private drafts, send feedback, editor upload.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const m = await vi.hoisted(async () => {
  const { createFakeModel } = await import("./helpers/fakeModel");
  return {
    Project: createFakeModel({ status: "in_review", currentVersion: 1, editors: [], references: [], editorInvites: [], brief: "" }),
    ProjectVersion: createFakeModel(),
    ReviewComment: createFakeModel({ status: "open", draft: false }),
    ReviewLink: createFakeModel({ revoked: false, role: "guest" }),
    Approval: createFakeModel(),
  };
});
vi.mock("../models/review.model", () => m);
vi.mock("../models/user.model", () => ({ default: { findOne: vi.fn(), find: vi.fn().mockResolvedValue([]) } }));
const mail = vi.hoisted(() => ({ mailLink: vi.fn().mockResolvedValue(true), notifyProject: vi.fn() }));
vi.mock("../utils/notify", () => ({ ...mail, reviewLinkUrl: (t: string) => `http://app/review/${t}` }));
vi.mock("../jobs/autoKit", () => ({ autoStartKit: vi.fn() }));
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
const as = (id: string) => ({ "x-user": id });
let pid = "";
let vid = "";

beforeEach(async () => {
  for (const model of Object.values(m)) (model as any).rows.length = 0;
  mail.mailLink.mockClear().mockResolvedValue(true);
  const p = await m.Project.create({ title: "Vid", owner: "owner" });
  pid = String(p._id);
  vid = String((await m.ProjectVersion.create({ project: pid, number: 1, kind: "link", processing: "ready", duration: 120, externalUrl: "https://youtu.be/x" }))._id);
});

const invite = (email = "ed@x.com", who = "owner") => request(app).post(`/v1/projects/${pid}/editor-invites`).set(as(who)).send({ email });
const enter = (token: string, body: any = {}) => request(app).post("/v1/review-links/enter").send({ token, ...body });
const tokenOf = (link: string) => link.split("/review/")[1];

describe("brief and references", () => {
  it("owner sets the brief; everyone on the project can read it", async () => {
    expect((await request(app).put(`/v1/projects/${pid}/brief`).set(as("owner")).send({ brief: "Cut the intro, add captions" })).status).toBe(200);
    const r = await request(app).get(`/v1/projects/${pid}`).set(as("owner"));
    expect(r.body.project.brief).toBe("Cut the intro, add captions");
  });
  it("only the owner can write brief/references", async () => {
    await m.Project.updateOne({ _id: pid }, { editors: ["editor"] });
    expect((await request(app).put(`/v1/projects/${pid}/brief`).set(as("editor")).send({ brief: "x" })).status).toBe(403);
    expect((await request(app).post(`/v1/projects/${pid}/references`).set(as("editor")).send({ url: "https://youtu.be/a" })).status).toBe(403);
    expect((await request(app).put(`/v1/projects/${pid}/brief`).set(as("stranger")).send({ brief: "x" })).status).toBe(404);
  });
  it("adds and removes link references; rejects bad input", async () => {
    const add = (b: any) => request(app).post(`/v1/projects/${pid}/references`).set(as("owner")).send(b);
    expect((await add({})).status).toBe(422);
    expect((await add({ url: "http://insecure.com/x" })).status).toBe(422);
    const ok = await add({ url: "https://www.instagram.com/reel/abc/", title: "Pace like this" });
    expect(ok.status).toBe(201);
    const got = await request(app).get(`/v1/projects/${pid}`).set(as("owner"));
    expect(got.body.project.references).toHaveLength(1);
    expect((await request(app).delete(`/v1/projects/${pid}/references/${ok.body.reference._id}`).set(as("owner"))).status).toBe(200);
    expect((await request(app).get(`/v1/projects/${pid}`).set(as("owner"))).body.project.references).toHaveLength(0);
  });
});

describe("editor magic-link invite", () => {
  it("emails the link once and remembers the editor", async () => {
    const r = await invite();
    expect(r.status).toBe(201);
    expect(r.body.emailSent).toBe(true);
    expect(mail.mailLink).toHaveBeenCalledWith("ed@x.com", expect.any(String), expect.any(String), expect.any(String), r.body.link, "Vid");
    const p = await request(app).get(`/v1/projects/${pid}`).set(as("owner"));
    expect(p.body.project.editorInvites.map((i: any) => i.email)).toEqual(["ed@x.com"]);
  });
  it("re-inviting revokes the old link and keeps one entry", async () => {
    const a = await invite();
    const b = await invite();
    expect((await enter(tokenOf(a.body.link))).status).toBe(401);
    expect((await enter(tokenOf(b.body.link))).status).toBe(200);
    expect((await request(app).get(`/v1/projects/${pid}`).set(as("owner"))).body.project.editorInvites).toHaveLength(1);
  });
  it("only the owner can invite; bad email rejected", async () => {
    await m.Project.updateOne({ _id: pid }, { editors: ["editor"] });
    expect((await invite("a@b.com", "editor")).status).toBe(403);
    expect((await invite("not-an-email")).status).toBe(422);
  });
  it("link needs no name or account and is flagged as editor", async () => {
    const r = await invite("Ed.Name@x.com");
    const t = tokenOf(r.body.link);
    expect((await request(app).get(`/v1/review-links/${t}/info`)).body).toMatchObject({ role: "editor", needsName: false });
    const e = await enter(t);
    expect(e.body).toMatchObject({ role: "editor", projectId: pid });
    expect((await request(app).get(`/v1/review-links/bogus-token-0000/info`)).status).toBe(404);
  });
  it("invited editor can view and upload a version but cannot approve, invite or change the brief", async () => {
    const t = (await enter(tokenOf((await invite()).body.link))).body.guestToken;
    const g = (req: request.Test) => req.set("x-guest-token", t);
    expect((await g(request(app).get(`/v1/projects/${pid}`))).body.project.role).toBe("editor");
    expect((await g(request(app).post(`/v1/projects/${pid}/versions`).send({ externalUrl: "https://youtu.be/new", note: "v2" }))).status).toBe(201);
    expect(m.ProjectVersion.rows[1].uploadedByName).toBeTruthy();
    expect((await g(request(app).post(`/v1/projects/${pid}/approval`).send({ action: "approve", versionId: vid }))).status).toBe(403);
    expect((await g(request(app).put(`/v1/projects/${pid}/brief`).send({ brief: "x" }))).status).toBe(403);
    expect((await g(request(app).post(`/v1/projects/${pid}/editor-invites`).send({ email: "z@z.com" }))).status).toBe(403);
  });
  it("a plain guest link cannot upload", async () => {
    const link: any = await m.ReviewLink.create({ project: pid, tokenHash: (await import("../utils/reviewTokens")).hashToken("guest-token-123456"), role: "guest" });
    expect(link).toBeTruthy();
    const t = (await enter("guest-token-123456", { name: "Gina" })).body.guestToken;
    expect((await request(app).post(`/v1/projects/${pid}/versions`).set("x-guest-token", t).send({ externalUrl: "https://youtu.be/q" })).status).toBe(403);
  });
});

describe("owner drafts and send feedback", () => {
  const owner = (body: any) => request(app).post(`/v1/projects/${pid}/versions/${vid}/comments`).set(as("owner")).send(body);
  const list = (hdr: Record<string, string>) => request(app).get(`/v1/projects/${pid}/versions/${vid}/comments`).set(hdr);

  it("owner comments are private drafts until sent", async () => {
    await invite();
    const t = (await enter(tokenOf((await request(app).post(`/v1/projects/${pid}/editor-invites`).set(as("owner")).send({ email: "ed@x.com" })).body.link))).body.guestToken;
    await owner({ body: "Trim here", timecode: 12 });
    expect((await list(as("owner"))).body.comments).toHaveLength(1);
    expect((await list({ "x-guest-token": t })).body.comments).toHaveLength(0);
  });
  it("send-feedback publishes drafts, sets changes_requested, emails the editor with the link", async () => {
    const inv = await invite();
    const t = (await enter(tokenOf(inv.body.link))).body.guestToken;
    mail.mailLink.mockClear();
    await owner({ body: "At 12:45 fix audio", timecode: 100 });
    await owner({ body: "Cut intro", timecode: 3 });
    const r = await request(app).post(`/v1/projects/${pid}/versions/${vid}/send-feedback`).set(as("owner"));
    expect(r.body).toMatchObject({ success: true, count: 2, emailed: 1 });
    const [to, subject, , body, link] = mail.mailLink.mock.calls[0];
    expect(to).toBe("ed@x.com");
    expect(subject).toMatch(/2 notes/);
    expect(body).toMatch(/0:03\s+Cut intro/);
    expect(body).toMatch(/1:40\s+At 12:45 fix audio/);
    expect(link).toBe(inv.body.link);
    expect((await list({ "x-guest-token": t })).body.comments).toHaveLength(2);
    expect(m.Project.rows[0].status).toBe("changes_requested");
  });
  it("refuses with nothing to send or no editor invited", async () => {
    expect((await request(app).post(`/v1/projects/${pid}/versions/${vid}/send-feedback`).set(as("owner"))).status).toBe(409);
    await owner({ body: "x", timecode: 1 });
    expect((await request(app).post(`/v1/projects/${pid}/versions/${vid}/send-feedback`).set(as("owner"))).status).toBe(409);
  });
  it("editor and strangers cannot send feedback", async () => {
    await m.Project.updateOne({ _id: pid }, { editors: ["editor"] });
    expect((await request(app).post(`/v1/projects/${pid}/versions/${vid}/send-feedback`).set(as("editor"))).status).toBe(403);
    expect((await request(app).post(`/v1/projects/${pid}/versions/${vid}/send-feedback`).set(as("stranger"))).status).toBe(404);
  });
  it("editor replies are visible to the owner immediately", async () => {
    const t = (await enter(tokenOf((await invite()).body.link))).body.guestToken;
    const r = await request(app).post(`/v1/projects/${pid}/versions/${vid}/comments`).set("x-guest-token", t).send({ body: "Done, check v2", timecode: 5 });
    expect(r.status).toBe(201);
    expect(r.body.comment.draft).toBe(false);
    expect((await list(as("owner"))).body.comments).toHaveLength(1);
  });
});
