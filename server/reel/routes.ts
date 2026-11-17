// REST API for the editing engine, mounted at /v1/reel. Auth: session cookie (all scopes) or
// `Authorization: Bearer rf_...` API token (scoped). Every handler calls the shared operation layer.
import express, { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import { z } from "zod";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import { requireUser } from "../middleware/projectAccess";
import { authIpLimiter } from "../middleware/rateLimit";
import { tmpDir } from "../utils/storage";
import { ApiToken } from "./models";
import { SCOPES, Scope, createApiToken, verifyApiToken } from "./apiTokens";
import * as op from "./operations";
import { EDIT_OPS } from "./registry";
import { asrStatus } from "./asr";
import { enqueueJob } from "./queue";

declare global { namespace Express { interface Request { reel?: { userId: string; scopes: Scope[]; viaToken: boolean } } } }

export const reelAuth: RequestHandler = async (req, res, next) => {
  try {
    const h = req.headers.authorization;
    if (h?.startsWith("Bearer ")) {
      const p = await verifyApiToken(h.slice(7));
      if (!p) throw new ErrorHandler(401, "Invalid or revoked API token");
      req.reel = { userId: p.userId, scopes: p.scopes, viaToken: true };
      return next();
    }
    await new Promise<void>((ok, bad) => requireUser(req, res, (e?: any) => (e ? bad(e) : ok())));
    req.reel = { userId: String(req.user?._id), scopes: [...SCOPES], viaToken: false };
    next();
  } catch (e) { next(e); }
};
export const need = (s: Scope): RequestHandler => (req, _res, next) =>
  req.reel!.scopes.includes(s) ? next() : next(new ErrorHandler(403, `This token lacks the ${s} scope`));

const who = (req: Request) => ({ userId: req.reel!.userId });
/** Clients never need private storage keys. */
export const publicTimeline = (row: any) => {
  const doc = JSON.parse(JSON.stringify(row.doc));
  for (const s of Object.values<any>(doc.sources ?? {})) delete s.storageKey;
  return { version: row.version, parent: row.parent, approved: row.approved, summary: row.summary, renders: row.renders, timeline: doc };
};

const upload = multer({
  storage: multer.diskStorage({ destination: (_r, _f, cb) => cb(null, tmpDir()), filename: (_r, _f, cb) => cb(null, crypto.randomBytes(16).toString("hex")) }),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 1024) * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => ([".mp4", ".mov", ".webm", ".mkv", ".m4v"].includes(path.extname(f.originalname).toLowerCase()) && /^video\//.test(f.mimetype) ? cb(null, true) : cb(new ErrorHandler(415, "Only mp4, mov, webm, mkv or m4v video files are allowed"))),
});

const parse = <T extends z.ZodTypeAny>(s: T, body: unknown): z.infer<T> => {
  const r = s.safeParse(body);
  if (!r.success) throw new ErrorHandler(422, `${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`.trim());
  return r.data;
};

const r = express.Router();
r.use("/reel", authIpLimiter, reelAuth);

r.get("/reel/capabilities", need("reel:read"), (_q, res) => res.json({ success: true, operations: EDIT_OPS.map((o) => ({ name: o.name, description: o.description })), asr: asrStatus() }));

r.post("/reel/projects", need("reel:write"), CatchAsyncError(async (req: Request, res: Response) => {
  const b = parse(z.object({ title: z.string().trim().min(1).max(120), brief: z.string().max(5000).optional() }), req.body);
  const p: any = await op.createProject(who(req), b.title, b.brief);
  res.status(201).json({ success: true, project: { id: String(p._id), title: p.title } });
}));

r.post("/reel/projects/:id/assets", need("reel:write"), (req, res, next) => upload.single("video")(req, res, (e: any) => (e?.code === "LIMIT_FILE_SIZE" ? next(new ErrorHandler(413, "File is too large")) : next(e))),
  CatchAsyncError(async (req: Request, res: Response) => {
    if (!req.file) throw new ErrorHandler(422, "Attach a video file in the `video` field");
    const a = await op.registerAsset(who(req), req.params.id!, req.file.path, req.file.originalname);
    res.status(201).json({ success: true, asset: op.assetJson(a) });
  }));

r.get("/reel/projects/:id/timeline", need("reel:read"), CatchAsyncError(async (req: Request, res: Response) => {
  const v = req.query.version ? Number(req.query.version) : undefined;
  res.json({ success: true, ...publicTimeline(await op.getTimeline(who(req), req.params.id!, v)) });
}));
r.get("/reel/projects/:id/timelines", need("reel:read"), CatchAsyncError(async (req: Request, res: Response) =>
  res.json({ success: true, timelines: await op.listTimelines(who(req), req.params.id!) })));

r.post("/reel/projects/:id/edits", need("reel:write"), CatchAsyncError(async (req: Request, res: Response) => {
  const b = parse(z.object({ op: z.string(), args: z.unknown().optional(), baseVersion: z.number().int().optional() }), req.body);
  res.status(201).json({ success: true, ...publicTimeline(await op.applyEdit(who(req), req.params.id!, b.op, b.args, b.baseVersion)) });
}));

r.post("/reel/projects/:id/transcribe", need("reel:write"), CatchAsyncError(async (req: Request, res: Response) => {
  const b = parse(z.object({ assetId: z.string(), provider: z.enum(["sarvam", "groq"]).optional(), script: z.enum(["native", "roman"]).optional(), languageHint: z.string().max(8).optional() }), req.body);
  const j: any = await op.startTranscribe(who(req), req.params.id!, b.assetId, b);
  await enqueueJob(String(j._id));
  res.status(202).json({ success: true, job: op.jobJson(j) });
}));

r.post("/reel/projects/:id/renders", need("reel:render"), CatchAsyncError(async (req: Request, res: Response) => {
  const b = parse(z.object({ version: z.number().int().min(1), quality: z.enum(["preview", "final"]).default("preview") }), req.body);
  const j: any = await op.startRender(who(req), req.params.id!, b.version, b.quality);
  await enqueueJob(String(j._id));
  res.status(202).json({ success: true, job: op.jobJson(j) });
}));

r.get("/reel/projects/:id/jobs/:jobId", need("reel:read"), CatchAsyncError(async (req: Request, res: Response) =>
  res.json({ success: true, job: op.jobJson(await op.getJob(who(req), req.params.id!, req.params.jobId!)) })));

r.post("/reel/projects/:id/timelines/:version/approve", need("reel:write"), CatchAsyncError(async (req: Request, res: Response) => {
  const row = await op.approveTimeline(who(req), req.params.id!, Number(req.params.version));
  res.json({ success: true, version: row.version, approved: row.approved });
}));

// API tokens: managed from a signed-in session only, never with another token.
const sessionOnly: RequestHandler = (req, _res, next) => (req.reel!.viaToken ? next(new ErrorHandler(403, "Manage tokens from a signed-in session")) : next());
r.post("/reel/tokens", sessionOnly, CatchAsyncError(async (req: Request, res: Response) => {
  const b = parse(z.object({ name: z.string().trim().min(1).max(60), scopes: z.array(z.enum(SCOPES)).min(1), days: z.number().int().min(1).max(365).optional() }), req.body);
  const t = await createApiToken(req.reel!.userId, b.name, b.scopes, b.days ? new Date(Date.now() + b.days * 864e5) : undefined);
  res.status(201).json({ success: true, token: t.raw, id: t.id, note: "Shown once. Store it now." });
}));
r.get("/reel/tokens", sessionOnly, CatchAsyncError(async (req: Request, res: Response) => {
  const rows: any[] = await ApiToken.find({ owner: req.reel!.userId });
  res.json({ success: true, tokens: rows.map((t) => ({ id: String(t._id), name: t.name, prefix: t.prefix, scopes: t.scopes, revoked: t.revoked, expiresAt: t.expiresAt, lastUsedAt: t.lastUsedAt })) });
}));
r.delete("/reel/tokens/:tid", sessionOnly, CatchAsyncError(async (req: Request, res: Response) => {
  await ApiToken.updateOne({ _id: req.params.tid, owner: req.reel!.userId }, { revoked: true });
  res.json({ success: true });
}));

export default r;
