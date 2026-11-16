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
  assertCan, commentInput, decideApproval, filterComments, nextVersionNumber, statusAfterNewVersion,
  validateNewComment, ApprovalAction,
} from "../services/reviewLogic";
import { hashToken, newLinkToken, signGuestToken, signStreamToken, verifyStreamToken } from "../utils/reviewTokens";
import { notifyProject } from "../utils/notify";
import { probeDuration, toHls } from "../utils/transcode";
import { resolveKey, versionDir, storageRoot } from "../utils/storage";
import { logger } from "../utils/logger";
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
});
const versionJson = (v: any) => ({
  _id: v._id, number: v.number, kind: v.kind, processing: v.processing, duration: v.duration,
  externalUrl: v.externalUrl, note: v.note, createdAt: v.createdAt, uploadedBy: v.uploadedBy,
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
      processing: file ? "pending" : "ready", uploadedBy: a.userId, note: body.note,
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
  const v: any = await ProjectVersion.findById(vid);
  if (!v?.hlsKey) throw new ErrorHandler(404, "Not found");
  const full = resolveKey(path.join(v.hlsKey, file));
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
  authorName: c.guestName || c.authorName || "User", authorKey: c.authorKey, createdAt: c.createdAt,
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
  const out = filterComments(list as any[], { status: q.status, mine: q.mine === "true", fromTime: q.from, toTime: q.to }, a.key);
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
    guestName: a.role === "guest" ? a.name : undefined, authorKey: a.key,
  });
  void notifyProject({
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
  if (!c) throw new ErrorHandler(404, "Comment not found");
  if (c.parentId) throw new ErrorHandler(422, "Resolve the thread, not a reply");
  c.status = status;
  c.resolvedBy = status === "resolved" ? a.userId : undefined;
  await c.save();
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
    z.object({ token: z.string().min(10).max(200), password: z.string().max(100).optional(), name: z.string().trim().min(1).max(60) }),
    req.body
  );
  const fail = () => new ErrorHandler(401, "This review link is invalid, expired or needs a different password");
  const link: any = await ReviewLink.findOne({ tokenHash: hashToken(token) });
  if (!link || link.revoked || (link.expiresAt && link.expiresAt < new Date())) throw fail();
  if (link.passwordHash && !(password && (await bcrypt.compare(password, link.passwordHash)))) throw fail();
  const project: any = await Project.findById(link.project);
  if (!project) throw fail();
  res.json({
    success: true, projectId: project._id, title: project.title,
    guestToken: signGuestToken({ pid: String(project._id), lid: String(link._id), name }, link.expiresAt),
  });
});
