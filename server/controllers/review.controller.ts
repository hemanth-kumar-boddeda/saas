import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import userModel from "../models/user.model";
import { emailQuery } from "../utils/email";
import { Project, ProjectVersion, ReviewComment, ReviewLink, Approval } from "../models/review.model";
import {
  annotationSchema, assertCan, commentInput, decideApproval, filterComments, nextVersionNumber, statusAfterNewVersion,
  validateNewComment, ApprovalAction,
} from "../services/reviewLogic";
import { hashToken, newLinkToken, signGuestToken, signStreamToken, verifyStreamToken } from "../utils/reviewTokens";
import { notifyProject, mailLink, reviewLinkUrl } from "../utils/notify";
import { decrypt, encrypt } from "../services/publishLogic";
import { probeDuration, toHls, probeAudioDuration, toVoiceM4a, makeSampleVideo } from "../utils/transcode";
import { resolveKey, versionDir, storageRoot } from "../utils/storage";
import { logger } from "../utils/logger";
import { transcribe } from "../utils/ai";
import { pickTranscriber } from "../services/aiProviders";
import { autoStartKit } from "../jobs/autoKit";

const oid = (v: string, what = "Resource") => {
  if (!mongoose.isValidObjectId(v)) throw new ErrorHandler(404, `${what} not found`);
  return v;
};
export const parse = <T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> => {
  const r = schema.safeParse(data);
  if (!r.success) throw new ErrorHandler(422, r.error.issues[0]?.message || "Invalid input");
  return r.data;
};
const projectJson = (p: any, role: string) => ({
  _id: p._id, title: p.title, status: p.status, currentVersion: p.currentVersion, owner: p.owner,
  editors: p.editors, createdAt: p.createdAt, role, channel: p.channel,
  brief: p.brief ?? "",
  references: (p.references ?? []).map((r: any) => ({ _id: r._id, kind: r.kind, title: r.title, url: r.url, processing: r.processing })),
  editorInvites: role === "owner" ? (p.editorInvites ?? []).map((i: any) => ({ email: i.email, invitedAt: i.invitedAt })) : undefined,
});
const versionJson = (v: any) => ({
  _id: v._id, number: v.number, kind: v.kind, processing: v.processing, duration: v.duration,
  externalUrl: v.externalUrl, note: v.note, createdAt: v.createdAt, uploadedBy: v.uploadedBy, uploadedByName: v.uploadedByName,
});
const getVersion = async (projectId: string, versionId: string) => {
  const v: any = mongoose.isValidObjectId(versionId) ? await ProjectVersion.findOne({ _id: versionId, project: projectId }) : null;
  if (!v) throw new ErrorHandler(404, "Version not found");
  return v;
};

// ---- projects ----
export const createProject = CatchAsyncError(async (req: Request, res: Response) => {
  const { title } = parse(z.object({ title: z.string().trim().min(1).max(120) }), req.body);
  const p = await Project.create({ title, owner: req.user!._id });
  res.status(201).json({ success: true, project: projectJson(p, "owner") });
});

/**
 * A ready-made project: two generated clips (so Compare works), a brief and a few notes, one already done.
 * One per owner; calling again returns the same project.
 */
export const createSampleProject = CatchAsyncError(async (req: Request, res: Response) => {
  const owner = req.user!._id;
  const had: any = await Project.findOne({ owner, sample: true });
  if (had) return res.json({ success: true, project: projectJson(had, "owner") });
  const project: any = await Project.create({
    title: "Sample: Brand reel", owner, sample: true, currentVersion: 2,
    brief: "This is a sample project. Tighten the intro, add captions and lift the music. Open version 2, press Compare versions, then approve to see the AI publish kit.",
  });
  try {
    for (const [number, pattern] of [[1, "testsrc2"], [2, "smptebars"]] as const) {
      const dir = versionDir(String(project._id), number);
      fs.mkdirSync(dir, { recursive: true });
      const src = path.join(dir, "source.mp4");
      await makeSampleVideo(src, pattern);
      const v: any = await ProjectVersion.create({
        project: project._id, number, kind: "upload", processing: "pending", uploadedByName: "Sample editor",
        sourceKey: path.relative(storageRoot(), src), note: number === 1 ? "First cut" : "Notes applied",
      });
      void processVersion(String(v._id), src, path.join(dir, "hls"));
      const note = (timecode: number, body: string, resolved = false) => ({
        project: project._id, version: v._id, timecode, body, guestName: "Sample feedback", authorKey: "sample",
        ...(resolved ? { status: "resolved", resolvedByName: "Sample editor" } : {}),
      });
      for (const c of number === 1
        ? [note(1, "Tighten the intro, the hook lands late.", true), note(3.5, "Add captions along the bottom."), note(6, "Lift the music under the voice.")]
        : [note(2, "Much better. Check the colours on this bar.")])
        await ReviewComment.create(c);
    }
  } catch (e) {
    await Promise.all([Project.deleteOne({ _id: project._id }), ProjectVersion.deleteMany({ project: project._id }), ReviewComment.deleteMany({ project: project._id })]);
    throw e;
  }
  res.status(201).json({ success: true, project: projectJson(project, "owner") });
});

export const listProjects = CatchAsyncError(async (req: Request, res: Response) => {
  const uid = String(req.user!._id);
  const list: any[] = await Project.find({ $or: [{ owner: uid }, { editors: uid }] }).sort({ updatedAt: -1 });
  res.json({ success: true, projects: list.map((p) => projectJson(p, String(p.owner) === uid ? "owner" : "editor")) });
});

export const getProject = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  const versions: any[] = await ProjectVersion.find({ project: a.project._id }).sort({ number: 1 });
  res.json({ success: true, project: projectJson(a.project, a.role), versions: versions.map(versionJson), me: { name: a.name, key: a.key } });
});

export const addEditor = CatchAsyncError(async (req: Request, res: Response) => {
  assertCan(req.actor!.role, "manage_links");
  const { email } = parse(z.object({ email: z.string().email() }), req.body);
  const user: any = await userModel.findOne(emailQuery(email));
  if (!user) throw new ErrorHandler(404, "No user with that e-mail. Ask them to sign up first.");
  await Project.updateOne({ _id: req.actor!.project._id }, { $addToSet: { editors: user._id } });
  res.json({ success: true });
});

// ---- versions ----
export const addVersion = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  assertCan(a.role, "upload_version");
  const file = req.file;
  const cleanup = () => file && fs.promises.unlink(file.path).catch(() => {});
  try {
    const body = parse(
      z.object({ externalUrl: z.string().url().max(500).refine((u) => u.startsWith("https://")).optional(), note: z.string().max(500).optional() }),
      req.body
    );
    if (!file && !body.externalUrl) throw new ErrorHandler(422, "Upload a video file or paste an unlisted link");
    const project: any = a.project;
    const status = statusAfterNewVersion(project.status);
    const existing: any[] = await ProjectVersion.find({ project: project._id }).select("number");
    const number = nextVersionNumber(existing.map((v) => v.number));
    const version: any = await ProjectVersion.create({
      project: project._id, number, kind: file ? "upload" : "link", externalUrl: file ? undefined : body.externalUrl,
      processing: file ? "pending" : "ready", uploadedBy: a.userId, uploadedByName: a.userId ? undefined : a.name, note: body.note,
    });
    await Project.updateOne({ _id: project._id }, { status, currentVersion: number });
    if (file) {
      const dir = versionDir(String(project._id), number);
      fs.mkdirSync(dir, { recursive: true });
      const src = path.join(dir, `source${path.extname(file.originalname).toLowerCase()}`);
      await fs.promises.rename(file.path, src);
      version.sourceKey = path.relative(storageRoot(), src);
      await version.save();
      void processVersion(String(version._id), src, path.join(dir, "hls"));
    }
    void notifyProject({
      project, exceptUserId: a.userId, subject: `New version v${number} of ${project.title}`,
      heading: `Version ${number} uploaded`, body: `${a.name} uploaded version ${number}. Review is open again.`,
    });
    res.status(201).json({ success: true, version: versionJson(version) });
  } catch (e) {
    await cleanup();
    throw e;
  }
});

const processVersion = async (versionId: string, src: string, hlsDir: string) => {
  try {
    const duration = await probeDuration(src);
    await toHls(src, hlsDir);
    await ProjectVersion.updateOne({ _id: versionId }, { processing: "ready", duration, hlsKey: path.relative(storageRoot(), hlsDir) });
  } catch (e: any) {
    logger.error("transcode_failed", { versionId, errorMessage: e?.message });
    await ProjectVersion.updateOne({ _id: versionId }, { processing: "failed" });
  }
};

/** Short-lived signed playlist URL. The browser never sees a file path. */
export const streamUrl = CatchAsyncError(async (req: Request, res: Response) => {
  const v = await getVersion(String(req.actor!.project._id), req.params.vid);
  if (v.kind === "link") return res.json({ success: true, kind: "link", url: v.externalUrl });
  if (v.processing !== "ready") throw new ErrorHandler(409, `Video is ${v.processing}`);
  const t = signStreamToken(String(v._id));
  res.json({ success: true, kind: "hls", url: `/v1/stream/${v._id}/index.m3u8?t=${t}` });
});

/** Serves HLS playlist + segments for a valid signed token. No download headers. */
export const serveStream = CatchAsyncError(async (req: Request, res: Response) => {
  const { vid, file } = req.params;
  const t = req.query.t;
  if (!mongoose.isValidObjectId(vid) || !verifyStreamToken(t, vid)) throw new ErrorHandler(403, "Invalid or expired stream link");
  if (!/^(index\.m3u8|seg_\d{4}\.ts)$/.test(file)) throw new ErrorHandler(404, "Not found");
  let hlsKey: string | undefined = (await ProjectVersion.findById(vid) as any)?.hlsKey;
  if (!hlsKey) hlsKey = ((await Project.findOne({ "references._id": vid }) as any)?.references ?? []).find((r: any) => String(r._id) === vid)?.hlsKey;
  if (!hlsKey) throw new ErrorHandler(404, "Not found");
  const full = resolveKey(path.join(hlsKey, file));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (file.endsWith(".m3u8")) {
    const text = (await fs.promises.readFile(full, "utf8")).replace(/^(seg_\d{4}\.ts)$/gm, `$1?t=${encodeURIComponent(String(t))}`);
    res.type("application/vnd.apple.mpegurl").send(text);
  } else {
    res.type("video/mp2t");
    fs.createReadStream(full).on("error", () => res.status(404).end()).pipe(res);
  }
});

// ---- comments ----
const commentJson = (c: any) => ({
  _id: c._id, version: c.version, parentId: c.parentId, timecode: c.timecode, body: c.body, status: c.status,
  authorName: c.guestName || c.authorName || "User", authorKey: c.authorKey, createdAt: c.createdAt, draft: !!c.draft, annotation: c.annotation || undefined, resolvedByName: c.resolvedByName,
  audioUrl: c.audioKey ? `/v1/voice/${c._id}?t=${signStreamToken(String(c._id))}` : undefined, audioDuration: c.audioDuration,
  transcript: c.transcriptStatus === "ready" ? c.transcript : undefined, transcriptStatus: c.audioKey ? c.transcriptStatus : undefined,
});

export const listComments = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  const v = await getVersion(String(a.project._id), req.params.vid);
  const q = parse(
    z.object({
      status: z.enum(["open", "resolved"]).optional(),
      mine: z.enum(["true", "false"]).optional(),
      from: z.coerce.number().optional(),
      to: z.coerce.number().optional(),
    }),
    req.query
  );
  const rows: any[] = await ReviewComment.find({ version: v._id }).sort({ timecode: 1, createdAt: 1 }).populate("author", "name");
  const list = rows.map((c) => ({ ...c.toObject(), _id: String(c._id), versionId: String(v._id), parentId: c.parentId ? String(c.parentId) : null, authorName: c.author?.name }));
  // Owner drafts stay private until "Send feedback".
  const visible = list.filter((c) => !c.draft || c.authorKey === a.key);
  const out = filterComments(visible as any[], { status: q.status, mine: q.mine === "true", fromTime: q.from, toTime: q.to }, a.key);
  res.json({ success: true, comments: out.map(commentJson) });
});

export const addComment = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  assertCan(a.role, "comment");
  const v = await getVersion(String(a.project._id), req.params.vid);
  const input = parse(commentInput, req.body);
  const parent: any = input.parentId && mongoose.isValidObjectId(input.parentId) ? await ReviewComment.findById(input.parentId) : null;
  validateNewComment(input, { _id: String(v._id), duration: v.duration }, parent && { _id: String(parent._id), versionId: String(parent.version), parentId: parent.parentId && String(parent.parentId), timecode: parent.timecode, status: parent.status, authorKey: parent.authorKey });
  const c: any = await ReviewComment.create({
    project: a.project._id, version: v._id, parentId: parent?._id ?? null,
    // A reply sits at its parent's time so the thread stays on one marker.
    timecode: parent ? parent.timecode : input.timecode, body: input.body, author: a.userId,
    guestName: a.userId ? undefined : a.name, authorKey: a.key,
    draft: a.role === "owner", annotation: input.annotation,
  });
  if (!c.draft) void notifyProject({
    project: a.project, exceptUserId: a.userId, subject: `New comment on ${a.project.title}`,
    heading: "New comment", body: `${a.name} commented at ${Math.floor(c.timecode)}s: ${input.body.slice(0, 200)}`,
  });
  res.status(201).json({ success: true, comment: commentJson({ ...c.toObject(), authorName: a.name }) });
});

export const setCommentStatus = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  assertCan(a.role, "resolve");
  const { status } = parse(z.object({ status: z.enum(["open", "resolved"]) }), req.body);
  const c: any = mongoose.isValidObjectId(req.params.cid) ? await ReviewComment.findOne({ _id: req.params.cid, project: a.project._id }) : null;
  if (!c || (c.draft && c.authorKey !== a.key)) throw new ErrorHandler(404, "Comment not found");
  if (c.parentId) throw new ErrorHandler(422, "Resolve the thread, not a reply");
  c.status = status;
  c.resolvedBy = status === "resolved" ? a.userId : undefined;
  c.resolvedByName = status === "resolved" ? a.name : undefined;
  await c.save();
  // Editor ticked the last open change: tell the owner it is ready to review again.
  if (status === "resolved" && a.role === "editor") {
    const roots: any[] = await ReviewComment.find({ version: c.version, parentId: null, draft: false });
    if (roots.length && roots.every((r) => r.status === "resolved")) {
      void notifyProject({
        project: a.project, exceptUserId: a.userId, subject: `All changes done: ${a.project.title}`,
        heading: "Editor marked every change as done", body: `${a.name} ticked all ${roots.length} requested change${roots.length === 1 ? "" : "s"}. Open the review to check the new cut.`,
      });
    }
  }
  res.json({ success: true });
});

// ---- approval ----
export const decide = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  const { action, note, versionId } = parse(
    z.object({ action: z.enum(["approve", "request_changes"]), note: z.string().max(1000).optional(), versionId: z.string() }),
    req.body
  );
  const v = await getVersion(String(a.project._id), versionId);
  const next = decideApproval(a.project.status, action as ApprovalAction, a.role, v.number === a.project.currentVersion);
  await Project.updateOne({ _id: a.project._id }, { status: next });
  await Approval.create({ project: a.project._id, version: v._id, versionNumber: v.number, user: a.userId, action, note });
  void notifyProject({
    project: a.project, exceptUserId: a.userId,
    subject: `${action === "approve" ? "Approved" : "Changes requested"}: ${a.project.title}`,
    heading: action === "approve" ? "Version approved" : "Changes requested",
    body: `${a.name} ${action === "approve" ? "approved" : "requested changes on"} version ${v.number}.${note ? " Note: " + note : ""}`,
  });
  // Approved -> AI publish kit starts by itself (best effort, never blocks the approval).
  const kitStarted = action === "approve" ? await autoStartKit(String(a.project._id), v.number) : false;
  res.json({ success: true, status: next, kitStarted });
});

export const approvalLog = CatchAsyncError(async (req: Request, res: Response) => {
  const rows: any[] = await Approval.find({ project: req.actor!.project._id }).sort({ createdAt: -1 }).populate("user", "name");
  res.json({ success: true, approvals: rows.map((r) => ({ _id: r._id, action: r.action, versionNumber: r.versionNumber, by: r.user?.name, note: r.note, at: r.createdAt })) });
});

// ---- guest links ----
export const createLink = CatchAsyncError(async (req: Request, res: Response) => {
  assertCan(req.actor!.role, "manage_links");
  const { password, expiresInDays } = parse(
    z.object({ password: z.string().min(4).max(100).optional(), expiresInDays: z.number().int().min(1).max(365).optional() }),
    req.body
  );
  const raw = newLinkToken();
  const link: any = await ReviewLink.create({
    project: req.actor!.project._id, tokenHash: hashToken(raw), createdBy: req.actor!.userId,
    passwordHash: password ? await bcrypt.hash(password, 10) : undefined,
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : undefined,
  });
  // The raw token is shown once; only its hash is stored.
  res.status(201).json({ success: true, link: { _id: link._id, token: raw, expiresAt: link.expiresAt, hasPassword: !!password } });
});

export const listLinks = CatchAsyncError(async (req: Request, res: Response) => {
  assertCan(req.actor!.role, "manage_links");
  const rows: any[] = await ReviewLink.find({ project: req.actor!.project._id }).sort({ createdAt: -1 });
  res.json({ success: true, links: rows.map((l) => ({ _id: l._id, expiresAt: l.expiresAt, revoked: l.revoked, hasPassword: !!l.passwordHash, createdAt: l.createdAt })) });
});

export const revokeLink = CatchAsyncError(async (req: Request, res: Response) => {
  assertCan(req.actor!.role, "manage_links");
  const r = mongoose.isValidObjectId(req.params.lid)
    ? await ReviewLink.updateOne({ _id: req.params.lid, project: req.actor!.project._id }, { revoked: true })
    : { matchedCount: 0 };
  if (!r.matchedCount) throw new ErrorHandler(404, "Link not found");
  res.json({ success: true });
});

/** Guest enters with the link token (+ optional password). Same error for every failure. */
export const enterLink = CatchAsyncError(async (req: Request, res: Response) => {
  const { token, password, name } = parse(
    z.object({ token: z.string().min(10).max(200), password: z.string().max(100).optional(), name: z.string().trim().min(1).max(60).optional() }),
    req.body
  );
  const fail = () => new ErrorHandler(401, "This review link is invalid, expired or needs a different password");
  const link: any = await ReviewLink.findOne({ tokenHash: hashToken(token) });
  if (!link || link.revoked || (link.expiresAt && link.expiresAt < new Date())) throw fail();
  if (link.passwordHash && !(password && (await bcrypt.compare(password, link.passwordHash)))) throw fail();
  const project: any = await Project.findById(link.project);
  if (!project) throw fail();
  const who = name || (link.email ? String(link.email).split("@")[0] : "");
  if (!who) throw new ErrorHandler(422, "Enter your name");
  res.json({
    success: true, projectId: project._id, title: project.title, role: link.role === "editor" ? "editor" : "guest",
    guestToken: signGuestToken({ pid: String(project._id), lid: String(link._id), name: who }, link.expiresAt),
  });
});

/** What a link is for, so the page can skip the name prompt for invited editors. Same 404 for every failure. */
export const inspectLink = CatchAsyncError(async (req: Request, res: Response) => {
  const link: any = await ReviewLink.findOne({ tokenHash: hashToken(String(req.params.token)) });
  if (!link || link.revoked || (link.expiresAt && link.expiresAt < new Date())) throw new ErrorHandler(404, "This review link is invalid or expired");
  res.json({ success: true, role: link.role === "editor" ? "editor" : "guest", hasPassword: !!link.passwordHash, needsName: link.role !== "editor" });
});

// ---- brief + references (owner writes, everyone on the project reads) ----
export const setBrief = CatchAsyncError(async (req: Request, res: Response) => {
  assertCan(req.actor!.role, "manage_links");
  const { brief } = parse(z.object({ brief: z.string().max(5000) }), req.body);
  await Project.updateOne({ _id: req.actor!.project._id }, { brief });
  res.json({ success: true });
});

export const addReference = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  assertCan(a.role, "manage_links");
  const file = req.file;
  try {
    const body = parse(z.object({
      title: z.string().trim().max(120).optional(),
      url: z.string().url().max(500).refine((u) => u.startsWith("https://"), "Use an https link").optional(),
    }), req.body);
    if (!file && !body.url) throw new ErrorHandler(422, "Add a link or upload a reference video");
    if ((a.project.references ?? []).length >= 10) throw new ErrorHandler(409, "At most 10 references per project");
    const ref: any = { kind: file ? "upload" : "link", title: body.title || (file ? file.originalname.slice(0, 120) : undefined), url: file ? undefined : body.url, processing: file ? "pending" : "ready" };
    await Project.updateOne({ _id: a.project._id }, { $push: { references: ref } });
    const fresh: any = await Project.findById(a.project._id);
    const saved = fresh.references[fresh.references.length - 1];
    if (file) {
      const dir = path.join(storageRoot(), "projects", String(a.project._id), "refs", String(saved._id));
      fs.mkdirSync(dir, { recursive: true });
      const src = path.join(dir, `source${path.extname(file.originalname).toLowerCase()}`);
      await fs.promises.rename(file.path, src);
      void processReference(String(a.project._id), String(saved._id), src, path.join(dir, "hls"));
    }
    res.status(201).json({ success: true, reference: { _id: saved._id, kind: saved.kind, title: saved.title, url: saved.url, processing: saved.processing } });
  } catch (e) {
    if (file) await fs.promises.unlink(file.path).catch(() => {});
    throw e;
  }
});

const processReference = async (projectId: string, refId: string, src: string, hlsDir: string) => {
  const set = (processing: string, hlsKey?: string) =>
    Project.updateOne({ _id: projectId, "references._id": refId }, { $set: { "references.$.processing": processing, ...(hlsKey ? { "references.$.hlsKey": hlsKey } : {}) } });
  try {
    await probeDuration(src);
    await toHls(src, hlsDir);
    await set("ready", path.relative(storageRoot(), hlsDir));
  } catch (e: any) {
    logger.error("reference_transcode_failed", { refId, errorMessage: e?.message });
    await set("failed");
  }
};

export const deleteReference = CatchAsyncError(async (req: Request, res: Response) => {
  assertCan(req.actor!.role, "manage_links");
  if (!mongoose.isValidObjectId(req.params.rid)) throw new ErrorHandler(404, "Reference not found");
  await Project.updateOne({ _id: req.actor!.project._id }, { $pull: { references: { _id: req.params.rid } } });
  res.json({ success: true });
});

export const referenceStreamUrl = CatchAsyncError(async (req: Request, res: Response) => {
  const r: any = (req.actor!.project.references ?? []).find((x: any) => String(x._id) === req.params.rid);
  if (!r) throw new ErrorHandler(404, "Reference not found");
  if (r.kind === "link") return res.json({ success: true, kind: "link", url: r.url });
  if (r.processing !== "ready") throw new ErrorHandler(409, `Video is ${r.processing}`);
  res.json({ success: true, kind: "hls", url: `/v1/stream/${r._id}/index.m3u8?t=${signStreamToken(String(r._id))}` });
});

// ---- editor invites: one e-mail, then a magic link; no account needed ----
export const inviteEditor = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  assertCan(a.role, "manage_links");
  const { email } = parse(z.object({ email: z.string().trim().toLowerCase().email().max(200) }), req.body);
  const project: any = a.project;
  // One live link per editor e-mail: re-inviting replaces the old link.
  const old = (project.editorInvites ?? []).find((i: any) => i.email === email);
  if (old?.linkId) await ReviewLink.updateOne({ _id: old.linkId }, { revoked: true });
  const raw = newLinkToken();
  const link: any = await ReviewLink.create({
    project: project._id, tokenHash: hashToken(raw), createdBy: a.userId, role: "editor", email, rawEnc: encrypt(raw),
    expiresAt: new Date(Date.now() + 90 * 86400000),
  });
  await Project.updateOne({ _id: project._id }, { $pull: { editorInvites: { email } } });
  await Project.updateOne({ _id: project._id }, { $push: { editorInvites: { email, linkId: link._id, invitedAt: new Date() } } });
  const url = reviewLinkUrl(raw);
  const emailSent = await mailLink(
    email, `${a.name} invited you to edit "${project.title}"`, "You have been invited as the editor",
    `${a.name} added you as the editor. Open the link to watch the video, read the notes and reference videos, and see feedback at exact timestamps. Upload your updated cut there when it is ready.`,
    url, project.title
  );
  // The raw link is shown once so the owner can also share it manually.
  res.status(201).json({ success: true, invite: { email }, emailSent, link: url });
});

/** Publishes the owner's private drafts for this version and mails every invited editor one digest. */
export const sendFeedback = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  assertCan(a.role, "approve");
  const v = await getVersion(String(a.project._id), req.params.vid);
  const drafts: any[] = await ReviewComment.find({ version: v._id, authorKey: a.key, draft: true }).sort({ timecode: 1 });
  if (!drafts.length) throw new ErrorHandler(409, "No feedback to send. Add comments first.");
  if (!(a.project.editorInvites ?? []).length && !(a.project.editors ?? []).length) throw new ErrorHandler(409, "Invite your editor first so they receive the feedback");
  await ReviewComment.updateMany({ version: v._id, authorKey: a.key, draft: true }, { draft: false });
  if (a.project.status === "in_review") await Project.updateOne({ _id: a.project._id }, { status: "changes_requested" });
  const lines = drafts.map((d) => `${Math.floor(d.timecode / 60)}:${String(Math.floor(d.timecode % 60)).padStart(2, "0")}  ${d.audioKey ? `[voice note ${Math.round(d.audioDuration || 0)}s]${d.body ? " " + d.body : ""}${d.transcriptStatus === "ready" ? ` "${d.transcript}"` : ""}` : d.body}`).join("\n");
  let sent = 0;
  for (const inv of a.project.editorInvites ?? []) {
    const link: any = await ReviewLink.findById(inv.linkId);
    if (!link || link.revoked) continue;
    if (!link.rawEnc) continue;
    if (await mailLink(inv.email, `Feedback on "${a.project.title}" (${drafts.length} notes)`, `${drafts.length} change${drafts.length === 1 ? "" : "s"} requested`, `${a.name} sent feedback on version ${v.number}:\n${lines}`, reviewLinkUrl(decrypt(link.rawEnc)), a.project.title)) sent++;
  }
  void notifyProject({ project: a.project, exceptUserId: a.userId, subject: `Feedback on ${a.project.title}`, heading: `${drafts.length} change${drafts.length === 1 ? "" : "s"} requested`, body: lines });
  res.json({ success: true, count: drafts.length, emailed: sent });
});

// ---- voice notes ----
export const MAX_VOICE_SECONDS = 180;

// Transcription costs money: at most N notes per actor per hour, the rest stay audio-only.
// ponytail: per-process counter, move to Redis if the API runs on several instances.
const transcribed = new Map<string, number[]>();
const MAX_TRANSCRIPTS_PER_HOUR = Number(process.env.TRANSCRIPTS_PER_HOUR) || 30;
const mayTranscribe = (key: string) => {
  const now = Date.now();
  const recent = (transcribed.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= MAX_TRANSCRIPTS_PER_HOUR) { transcribed.set(key, recent); return false; }
  transcribed.set(key, [...recent, now]);
  return true;
};

/** Background speech-to-text. Never blocks or fails the comment: on error the note just has no text. */
const transcribeVoice = async (id: string, file: string) => {
  try {
    const { text } = await transcribe(file);
    await ReviewComment.updateOne({ _id: id }, { transcript: text.trim().slice(0, 4000), transcriptStatus: "ready" });
  } catch (e: any) {
    logger.error("voice_transcript_failed", { commentId: id, errorMessage: e?.message });
    await ReviewComment.updateOne({ _id: id }, { transcriptStatus: "failed" }).catch(() => {});
  }
};

/** A spoken comment at an exact time. Same rules as text comments (owner's stay drafts until sent). */
export const addVoiceComment = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  const file = req.file;
  const cleanup = () => file && fs.promises.unlink(file.path).catch(() => {});
  try {
    assertCan(a.role, "comment");
    if (!file) throw new ErrorHandler(422, "Record or upload a voice note");
    const v = await getVersion(String(a.project._id), req.params.vid);
    const input = parse(z.object({ timecode: z.coerce.number().finite().min(0), parentId: z.string().optional(), body: z.string().trim().max(2000).optional() }), req.body);
    let annotation: any;
    if (req.body.annotation) {
      try { annotation = parse(annotationSchema, JSON.parse(String(req.body.annotation))); } catch (e) { throw e instanceof ErrorHandler ? e : new ErrorHandler(422, "Invalid drawing"); }
    }
    const parent: any = input.parentId && mongoose.isValidObjectId(input.parentId) ? await ReviewComment.findById(input.parentId) : null;
    validateNewComment({ body: input.body || "voice", timecode: input.timecode, parentId: input.parentId }, { _id: String(v._id), duration: v.duration },
      parent && { _id: String(parent._id), versionId: String(parent.version), parentId: parent.parentId && String(parent.parentId), timecode: parent.timecode, status: parent.status, authorKey: parent.authorKey });
    let duration: number;
    try { duration = await probeAudioDuration(file.path); } catch { throw new ErrorHandler(422, "That file is not playable audio"); }
    if (duration > MAX_VOICE_SECONDS) throw new ErrorHandler(422, `Voice notes can be at most ${MAX_VOICE_SECONDS / 60} minutes`);
    // Audio first, so the comment is saved with its audio path in one step (text is optional only with audio).
    const _id = new mongoose.Types.ObjectId();
    const dir = path.join(storageRoot(), "projects", String(a.project._id), "voice");
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `${_id}.m4a`);
    await toVoiceM4a(file.path, out);
    let c: any;
    try {
      c = await ReviewComment.create({
        _id, project: a.project._id, version: v._id, parentId: parent?._id ?? null,
        timecode: parent ? parent.timecode : input.timecode, body: input.body || "", author: a.userId,
        guestName: a.userId ? undefined : a.name, authorKey: a.key, draft: a.role === "owner", audioDuration: duration, annotation,
        audioKey: path.relative(storageRoot(), out), transcriptStatus: pickTranscriber(process.env) && mayTranscribe(a.key) ? "pending" : "none",
      });
    } catch (e) {
      await fs.promises.unlink(out).catch(() => {});
      throw e;
    }
    if (c.transcriptStatus === "pending") void transcribeVoice(String(c._id), out);
    if (!c.draft) void notifyProject({
      project: a.project, exceptUserId: a.userId, subject: `New voice note on ${a.project.title}`,
      heading: "New voice note", body: `${a.name} left a voice note at ${Math.floor(c.timecode)}s. Open the review to listen.`,
    });
    res.status(201).json({ success: true, comment: commentJson({ ...c.toObject(), authorName: a.name }) });
  } finally {
    await cleanup();
  }
});

/** Serves a voice note for a valid signed token. Range requests work (sendFile). */
export const serveVoice = CatchAsyncError(async (req: Request, res: Response) => {
  const { cid } = req.params;
  if (!mongoose.isValidObjectId(cid) || !verifyStreamToken(req.query.t, cid)) throw new ErrorHandler(403, "Invalid or expired link");
  const c: any = await ReviewComment.findById(cid);
  if (!c?.audioKey) throw new ErrorHandler(404, "Not found");
  res.setHeader("Cache-Control", "private, no-store");
  res.type("audio/mp4").sendFile(resolveKey(c.audioKey));
});
