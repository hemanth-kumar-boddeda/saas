import { Request, Response } from "express";
import mongoose from "mongoose";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { Project, ProjectVersion } from "../models/review.model";
import { PublishKit } from "../models/publishkit.model";
import { Publication, SocialAccount } from "../models/social.model";
import { assertCan } from "../services/reviewLogic";
import { encrypt, publishInput, resolveSchedule, signState, verifyMedia, verifyState } from "../services/publishLogic";
import { accessToken, dequeuePublish, enqueuePublish } from "../jobs/publish";
import { resolveKey, versionDir } from "../utils/storage";
import * as yt from "../utils/youtube";
import * as ig from "../utils/instagram";
import { parse } from "./review.controller";
import path from "path";

const providers = { youtube: yt, instagram: ig } as const;
type Provider = keyof typeof providers;
const prov = (p: string): Provider => {
  if (p !== "youtube" && p !== "instagram") throw new ErrorHandler(404, "Unknown platform");
  return p;
};
const accountJson = (a: any) => ({ _id: a._id, provider: a.provider, name: a.name, needsReconnect: !!a.needsReconnect });
const pubJson = (p: any) => ({
  _id: p._id, provider: p.provider, status: p.status, privacy: p.privacy, scheduledAt: p.scheduledAt,
  url: p.url, error: p.error, createdAt: p.createdAt,
});

// ---- accounts ----
export const listAccounts = CatchAsyncError(async (req: Request, res: Response) => {
  const rows: any[] = await SocialAccount.find({ user: req.user!._id });
  res.json({ success: true, accounts: rows.map(accountJson) });
});

/** Returns the consent URL; the browser navigates to it. State binds the callback to this user. */
export const connect = CatchAsyncError(async (req: Request, res: Response) => {
  const p = prov(req.params.provider);
  res.json({ success: true, url: providers[p].authUrl(signState(String(req.user!._id), p)) });
});

/** OAuth redirect target. No session here: the signed state identifies the user. */
export const callback = CatchAsyncError(async (req: Request, res: Response) => {
  const p = prov(req.params.provider);
  const back = (q: string) => res.redirect(`${(process.env.CLIENT_ORIGIN || "http://localhost:3000").split(",")[0]}/projects?${q}`);
  const userId = verifyState(req.query.state, p);
  if (!userId) return back("social_error=invalid_state");
  if (typeof req.query.code !== "string") return back("social_error=denied");
  try {
    const t: any = await providers[p].exchangeCode(req.query.code);
    const expiresAt = new Date(Date.now() + (t.expires_in ?? t.expiresIn ?? 3600) * 1000);
    const set: any = { name: t.name, accessToken: encrypt(t.access_token ?? t.accessToken), expiresAt, needsReconnect: false };
    if (t.refresh_token) set.refreshToken = encrypt(t.refresh_token);
    await SocialAccount.updateOne({ user: userId, provider: p, externalId: t.externalId }, set, { upsert: true });
    back(`connected=${p}`);
  } catch (e: any) {
    back(`social_error=${encodeURIComponent(String(e.message).slice(0, 120))}`);
  }
});

export const disconnect = CatchAsyncError(async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.aid)) throw new ErrorHandler(404, "Account not found");
  const r: any = await SocialAccount.deleteOne({ _id: req.params.aid, user: req.user!._id });
  if (!r.deletedCount) throw new ErrorHandler(404, "Account not found");
  res.json({ success: true });
});

// ---- publishing ----
export const createPublication = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  assertCan(a.role, "publish");
  const input = parse(publishInput, req.body);
  let when: Date | null;
  try { when = resolveSchedule(input.scheduledAt); } catch (e: any) { throw new ErrorHandler(422, e.message); }
  if (a.project.status !== "approved" && a.project.status !== "published") throw new ErrorHandler(409, "Approve the project before publishing");
  const account: any = await SocialAccount.findOne({ _id: input.accountId, user: a.userId });
  if (!account || account.provider !== input.provider) throw new ErrorHandler(404, "Connected account not found");
  if (account.needsReconnect) throw new ErrorHandler(409, "Reconnect this account first");
  const kits: any[] = await PublishKit.find({ project: a.project._id }).sort({ createdAt: -1 });
  const kit = kits[0];
  if (!kit || kit.status !== "ready") throw new ErrorHandler(409, "Generate and review the publish kit first");
  const v: any = await ProjectVersion.findOne({ project: a.project._id, number: a.project.currentVersion });
  if (!v?.sourceKey || v.processing !== "ready") throw new ErrorHandler(409, "Publishing needs the uploaded video");
  const existing: any[] = await Publication.find({ project: a.project._id, kit: kit._id, provider: input.provider });
  if (existing.some((p) => p.status !== "failed" && p.status !== "canceled")) throw new ErrorHandler(409, `Already ${existing[0].status} on ${input.provider} for this kit`);

  const pub: any = await Publication.create({
    project: a.project._id, kit: kit._id, account: account._id, provider: input.provider,
    privacy: input.provider === "youtube" ? input.privacy : undefined, scheduledAt: when ?? undefined, createdBy: a.userId,
  });
  try {
    // YouTube holds the schedule itself; Instagram waits in the queue.
    await enqueuePublish(String(pub._id), input.provider === "instagram" && when ? when.getTime() - Date.now() : 0);
  } catch {
    await Publication.updateOne({ _id: pub._id }, { status: "failed", error: "Could not queue the job" });
    throw new ErrorHandler(503, "Could not queue the job. Try again shortly.");
  }
  res.status(202).json({ success: true, publication: pubJson(pub) });
});

export const listPublications = CatchAsyncError(async (req: Request, res: Response) => {
  const rows: any[] = await Publication.find({ project: req.actor!.project._id }).sort({ createdAt: -1 });
  res.json({ success: true, publications: rows.map(pubJson) });
});

/**
 * Cancels a post that has not gone out yet. Instagram: still waiting in the queue. YouTube: uploaded as
 * private with a publish time, so cancelling deletes that upload. Once released (or running) it is too late.
 */
export const cancelPublication = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  assertCan(a.role, "publish");
  const pub: any = mongoose.isValidObjectId(req.params.pid) ? await Publication.findOne({ _id: req.params.pid, project: a.project._id }) : null;
  if (!pub) throw new ErrorHandler(404, "Publication not found");
  if (!pub.scheduledAt || pub.scheduledAt.getTime() <= Date.now() || (pub.status !== "queued" && pub.status !== "scheduled"))
    throw new ErrorHandler(409, pub.status === "canceled" ? "Already canceled" : "Only a scheduled post that has not been released yet can be canceled");
  if (pub.status === "scheduled") {
    // Uploaded to YouTube already: remove it there first, so a failure leaves everything as it was.
    const acc: any = await SocialAccount.findById(pub.account);
    if (!acc || !pub.externalId) throw new ErrorHandler(409, "The connected account is gone. Delete the private video in YouTube Studio.");
    let token: string;
    try { token = await accessToken(acc); } catch { throw new ErrorHandler(409, "Reconnect the account to cancel this post"); }
    await yt.deleteVideo(token, pub.externalId);
  }
  const done: any = await Publication.updateOne({ _id: pub._id, status: pub.status }, { status: "canceled", error: undefined });
  if (!done.matchedCount) throw new ErrorHandler(409, "This post just started publishing and can no longer be canceled");
  await dequeuePublish(String(pub._id)).catch(() => {});
  // Nothing else live for this project: it is merely approved again.
  const rest: any[] = await Publication.find({ project: a.project._id });
  if (!rest.some((p) => p.status === "published" || p.status === "scheduled" || p.status === "publishing"))
    await Project.updateOne({ _id: a.project._id, status: "published" }, { status: "approved" });
  res.json({ success: true, publication: pubJson({ ...pub.toObject(), status: "canceled" }) });
});

/**
 * Meta fetches the video/cover from a public URL. Token is signed, bound to one publication and kind, 1 h.
 * Anyone holding the URL can fetch that file until it expires.
 */
export const publicMedia = CatchAsyncError(async (req: Request, res: Response) => {
  const { pid, kind } = req.params;
  if (!mongoose.isValidObjectId(pid) || (kind !== "video" && kind !== "cover") || !verifyMedia(req.query.t, pid, kind)) throw new ErrorHandler(403, "Invalid or expired link");
  const pub: any = await Publication.findById(pid);
  if (!pub || pub.provider !== "instagram") throw new ErrorHandler(404, "Not found");
  res.setHeader("Cache-Control", "private, no-store");
  if (kind === "video") {
    const project: any = await Project.findById(pub.project);
    return res.type("video/mp4").sendFile(path.join(versionDir(String(project._id), project.currentVersion), "ig.mp4"));
  }
  const kit: any = await PublishKit.findById(pub.kit);
  const t = kit?.thumbnails?.[kit.chosenThumbnail];
  if (!t) throw new ErrorHandler(404, "Not found");
  res.type("image/jpeg").sendFile(resolveKey(t.key));
});
