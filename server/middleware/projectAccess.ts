// Resolves who is calling (signed-in user or guest-link holder) and their role
// on :id. Every project endpoint goes through this: no role, no access.
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import ErrorHandler from "../utils/ErrorHandler";
import { generateAccessToken } from "../controllers/user.controller";
import { isAuthenticated } from "./auth";
import { Project, ReviewLink } from "../models/review.model";
import { verifyGuestToken } from "../utils/reviewTokens";
import { roleFor, ProjectRole } from "../services/reviewLogic";

export interface Actor {
  role: ProjectRole;
  /** Stable per-person key stored on comments. */
  key: string;
  name: string;
  userId?: string;
  project: any;
}

declare global {
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}

export const requireUser = (req: Request, res: Response, next: NextFunction) =>
  generateAccessToken(req, res, (err?: any) => (err ? next(err) : isAuthenticated(req, res, next)));

const guestHeader = (req: Request) => {
  const h = req.headers["x-guest-token"];
  return typeof h === "string" ? h : null;
};

export const projectAccess = (opts: { allowGuest?: boolean } = {}) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) throw new ErrorHandler(404, "Project not found");

      const gt = guestHeader(req);
      if (gt) {
        if (!opts.allowGuest) throw new ErrorHandler(403, "Guests cannot do this");
        const claims = verifyGuestToken(gt);
        if (!claims || claims.pid !== id) throw new ErrorHandler(401, "Invalid or expired review link");
        const link: any = await ReviewLink.findById(claims.lid);
        if (!link || link.revoked || (link.expiresAt && link.expiresAt < new Date())) {
          throw new ErrorHandler(401, "This review link is no longer valid");
        }
        const project = await Project.findById(id);
        if (!project) throw new ErrorHandler(404, "Project not found");
        req.actor = { role: "guest", key: `g:${claims.lid}:${claims.name}`, name: claims.name, project };
        return next();
      }

      await new Promise<void>((resolve, reject) => requireUser(req, res, (e?: any) => (e ? reject(e) : resolve())));
      const userId = String(req.user?._id);
      const project = await Project.findById(id);
      // Same 404 for "missing" and "not yours": no existence leak.
      const role = project ? roleFor(project, userId) : null;
      if (!project || !role) throw new ErrorHandler(404, "Project not found");
      req.actor = { role, key: `u:${userId}`, name: req.user?.name ?? "", userId, project };
      next();
    } catch (e) {
      next(e);
    }
  };
