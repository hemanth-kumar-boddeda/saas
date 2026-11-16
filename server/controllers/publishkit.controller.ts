import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { Project, ProjectVersion } from "../models/review.model";
import { Channel, PublishKit } from "../models/publishkit.model";
import { assertCan } from "../services/reviewLogic";
import { channelInput, kitEdit } from "../services/publishKitLogic";
import { enqueueKit } from "../jobs/publishKit";
import { resolveKey } from "../utils/storage";
import { parse } from "./review.controller";

const channelJson = (c: any) => ({ _id: c._id, name: c.name, niche: c.niche, tone: c.tone, brand: c.brand });
const kitJson = (k: any) => ({
  _id: k._id, version: k.version, status: k.status, step: k.step, error: k.error, titles: k.titles,
  chosenTitle: k.chosenTitle, description: k.description, chapters: k.chapters, hashtags: k.hashtags,
  tags: k.tags, srt: k.srt, chosenThumbnail: k.chosenThumbnail, edited: k.edited, updatedAt: k.updatedAt,
  thumbnails: (k.thumbnails ?? []).map((t: any, i: number) => ({
    label: t.label, text: t.text, score: t.score, url: `/v1/projects/${k.project}/kit/thumbnails/${i}`,
  })),
});
const latestKit = async (projectId: string): Promise<any> => (await PublishKit.find({ project: projectId }).sort({ createdAt: -1 }))[0] ?? null;

// ---- channel profiles (owned by the signed-in user) ----
export const createChannel = CatchAsyncError(async (req: Request, res: Response) => {
  const c = await Channel.create({ ...parse(channelInput, req.body), owner: req.user!._id });
  res.status(201).json({ success: true, channel: channelJson(c) });
});

export const listChannels = CatchAsyncError(async (req: Request, res: Response) => {
  const rows = await Channel.find({ owner: req.user!._id }).sort({ createdAt: -1 });
  res.json({ success: true, channels: rows.map(channelJson) });
});

export const updateChannel = CatchAsyncError(async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.cid)) throw new ErrorHandler(404, "Channel not found");
  const c: any = await Channel.findOne({ _id: req.params.cid, owner: req.user!._id });
  if (!c) throw new ErrorHandler(404, "Channel not found");
  Object.assign(c, parse(channelInput, req.body));
  await c.save();
  res.json({ success: true, channel: channelJson(c) });
});

export const setProjectChannel = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  assertCan(a.role, "publish");
  const { channelId } = parse(channelInputId, req.body);
  const c = channelId ? await Channel.findOne({ _id: channelId, owner: a.userId }) : null;
  if (channelId && !c) throw new ErrorHandler(404, "Channel not found");
  await Project.updateOne({ _id: a.project._id }, c ? { channel: c._id } : { $unset: { channel: 1 } });
  res.json({ success: true });
});
const channelInputId = z.object({ channelId: z.string().regex(/^[0-9a-f]{24}$/).nullable() });

// ---- publish kit ----
export const startKit = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  assertCan(a.role, "publish");
  if (a.project.status !== "approved") throw new ErrorHandler(409, "The publish kit is available after the owner approves the project");
  const v: any = await ProjectVersion.findOne({ project: a.project._id, number: a.project.currentVersion });
  if (!v || v.kind !== "upload") throw new ErrorHandler(409, "The AI kit needs an uploaded video, not a pasted link");
  if (v.processing !== "ready") throw new ErrorHandler(409, `Video is ${v.processing}`);
  const kits: any[] = await PublishKit.find({ project: a.project._id });
  if (kits.some((k) => k.status === "queued" || k.status === "running")) throw new ErrorHandler(409, "A kit is already being generated");
  const kit: any = await PublishKit.create({ project: a.project._id, version: v._id });
  try {
    await enqueueKit(String(kit._id));
  } catch (e) {
    await PublishKit.updateOne({ _id: kit._id }, { status: "failed", error: "Could not queue the job" });
    throw new ErrorHandler(503, "Could not queue the job. Try again shortly.");
  }
  res.status(202).json({ success: true, kit: kitJson(kit) });
});

export const getKit = CatchAsyncError(async (req: Request, res: Response) => {
  const k = await latestKit(String(req.actor!.project._id));
  res.json({ success: true, kit: k ? kitJson(k) : null });
});

export const editKit = CatchAsyncError(async (req: Request, res: Response) => {
  const a = req.actor!;
  assertCan(a.role, "publish");
  const edit = parse(kitEdit, req.body);
  const k: any = await latestKit(String(a.project._id));
  if (!k || k.status !== "ready") throw new ErrorHandler(409, "No finished kit to edit");
  Object.assign(k, edit, { edited: true });
  await k.save();
  res.json({ success: true, kit: kitJson(k) });
});

export const kitThumbnail = CatchAsyncError(async (req: Request, res: Response) => {
  const k: any = await latestKit(String(req.actor!.project._id));
  const t = k?.thumbnails?.[Number(req.params.n)];
  if (!t) throw new ErrorHandler(404, "Thumbnail not found");
  res.setHeader("Cache-Control", "private, no-store");
  res.type("image/jpeg").sendFile(resolveKey(t.key));
});

export const kitSrt = CatchAsyncError(async (req: Request, res: Response) => {
  const k: any = await latestKit(String(req.actor!.project._id));
  if (!k?.srt) throw new ErrorHandler(404, "No captions yet");
  res.setHeader("Content-Disposition", 'attachment; filename="captions.srt"');
  res.type("text/plain").send(k.srt);
});
