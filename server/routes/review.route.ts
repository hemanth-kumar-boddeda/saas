import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import ErrorHandler from "../utils/ErrorHandler";
import { requireUser, projectAccess } from "../middleware/projectAccess";
import { authIpLimiter } from "../middleware/rateLimit";
import { tmpDir } from "../utils/storage";
import * as c from "../controllers/review.controller";

const MAX_MB = Number(process.env.MAX_UPLOAD_MB) || 1024;
const ALLOWED = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);
const MIME = /^video\//;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, tmpDir()),
    filename: (_r, _f, cb) => cb(null, crypto.randomBytes(16).toString("hex")),
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) =>
    ALLOWED.has(path.extname(f.originalname).toLowerCase()) && MIME.test(f.mimetype)
      ? cb(null, true)
      : cb(new ErrorHandler(415, "Only mp4, mov, webm, mkv or m4v video files are allowed")),
});
const uploadMw: express.RequestHandler = (req, res, next) =>
  upload.single("video")(req, res, (err: any) =>
    err?.code === "LIMIT_FILE_SIZE" ? next(new ErrorHandler(413, `File is larger than ${MAX_MB} MB`)) : next(err)
  );

const r = express.Router();
const member = projectAccess();
const any = projectAccess({ allowGuest: true });

r.post("/review-links/enter", authIpLimiter, c.enterLink);
r.get("/stream/:vid/:file", c.serveStream);

r.post("/projects", requireUser, c.createProject);
r.get("/projects", requireUser, c.listProjects);
r.get("/projects/:id", any, c.getProject);
r.post("/projects/:id/editors", member, c.addEditor);

r.post("/projects/:id/versions", member, uploadMw, c.addVersion);
r.get("/projects/:id/versions/:vid/stream-url", any, c.streamUrl);
r.get("/projects/:id/versions/:vid/comments", any, c.listComments);
r.post("/projects/:id/versions/:vid/comments", any, c.addComment);
r.patch("/projects/:id/comments/:cid/status", member, c.setCommentStatus);

r.post("/projects/:id/approval", member, c.decide);
r.get("/projects/:id/approvals", member, c.approvalLog);

r.post("/projects/:id/links", member, c.createLink);
r.get("/projects/:id/links", member, c.listLinks);
r.delete("/projects/:id/links/:lid", member, c.revokeLink);

export default r;
