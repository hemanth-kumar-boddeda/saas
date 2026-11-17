// Operation layer shared by REST, MCP and the agent. Functions take a principal (who) and check
// project access themselves, so no interface can skip authorization.
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import ErrorHandler from "../utils/ErrorHandler";
import { Project, ProjectVersion } from "../models/review.model";
import { roleFor, assertCan, statusAfterNewVersion, nextVersionNumber } from "../services/reviewLogic";
import { probeDuration, run } from "../utils/transcode";
import { resolveKey, storageRoot } from "../utils/storage";
import { MediaAsset, ReelJob, ReelTimeline, Transcript } from "./models";
import { createJob } from "./jobs";
import { EDIT_OPS, OpContext, opByName } from "./registry";
import { EditError, fromSource } from "./ops";
import { Timeline, timelineSchema } from "./schema";
import { detectSilences, loudness } from "./render/measure";

export interface Principal { userId: string }

/** Same 404 for missing and not-yours (no existence leak). Owner or editor only. */
export const loadProject = async (p: Principal, projectId: string, perm: "view" | "upload_version" | "approve" = "view") => {
  if (!mongoose.isValidObjectId(projectId)) throw new ErrorHandler(404, "Project not found");
  const project: any = await Project.findById(projectId);
  const role = project ? roleFor(project, p.userId) : null;
  if (!project || !role) throw new ErrorHandler(404, "Project not found");
  assertCan(role, perm);
  return project;
};

export const createProject = async (p: Principal, title: string, brief = "") =>
  Project.create({ title, owner: p.userId, brief, status: "in_review", currentVersion: 0 });

const probeMedia = async (file: string) => {
  const j = JSON.parse(await run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]));
  const v = j.streams.find((s: any) => s.codec_type === "video");
  if (!v) throw new ErrorHandler(422, "File has no video stream");
  return { duration: await probeDuration(file), width: v.width as number, height: v.height as number, hasAudio: j.streams.some((s: any) => s.codec_type === "audio") };
};

/** Moves an uploaded file into private storage, probes it with ffprobe/ffmpeg, registers the asset. */
export const registerAsset = async (p: Principal, projectId: string, tmpFile: string, originalName: string) => {
  await loadProject(p, projectId, "upload_version");
  const id = new mongoose.Types.ObjectId();
  const rel = path.join("reel", projectId, String(id), `source${path.extname(originalName).toLowerCase() || ".mp4"}`);
  const dest = resolveKey(rel);
  try {
    const m = await probeMedia(tmpFile); // validates it is real media before it is kept
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await fs.promises.rename(tmpFile, dest);
    const probe = { loudnessLufs: m.hasAudio ? await loudness(dest) : undefined, silences: m.hasAudio ? await detectSilences(dest) : [] };
    const asset: any = await MediaAsset.create({ _id: id, project: projectId, owner: p.userId, kind: "video", storageKey: rel, originalName: originalName.slice(0, 200), ...m, probe });
    const has = await ReelTimeline.findOne({ project: projectId });
    if (!has) {
      const t = fromSource(projectId, String(id), { storageKey: rel, duration: m.duration, width: m.width, height: m.height, hasAudio: m.hasAudio });
      await ReelTimeline.create({ project: projectId, version: 1, parent: null, doc: t, createdBy: p.userId, summary: "Initial timeline from first upload" });
    }
    return asset;
  } catch (e) { await fs.promises.rm(tmpFile, { force: true }); throw e; }
};

export const assetJson = (a: any) => ({ id: String(a._id), name: a.originalName, duration: a.duration, width: a.width, height: a.height, hasAudio: a.hasAudio, loudnessLufs: a.probe?.loudnessLufs, silenceCount: a.probe?.silences?.length ?? 0 });

const latest = async (projectId: string) => {
  const rows: any[] = await ReelTimeline.find({ project: projectId }).sort({ version: -1 });
  return rows.sort((a, b) => b.version - a.version)[0] ?? null;
};
export const getTimeline = async (p: Principal, projectId: string, version?: number) => {
  await loadProject(p, projectId);
  const row = version ? await ReelTimeline.findOne({ project: projectId, version }) : await latest(projectId);
  if (!row) throw new ErrorHandler(404, "No timeline yet. Upload media first.");
  return row;
};
export const listTimelines = async (p: Principal, projectId: string) => {
  await loadProject(p, projectId);
  const rows: any[] = await ReelTimeline.find({ project: projectId });
  return rows.sort((a, b) => a.version - b.version).map((r) => ({ version: r.version, parent: r.parent, approved: r.approved, summary: r.summary, renders: r.renders }));
};

const contextFor = (projectId: string): OpContext => ({
  silences: async (sid) => {
    const a: any = await MediaAsset.findOne({ _id: sid, project: projectId });
    if (!a) throw new EditError(`unknown source ${sid}`);
    return a.probe?.silences ?? [];
  },
  words: async (sid) => {
    const rows: any[] = await Transcript.find({ asset: sid, project: projectId });
    const t = rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    if (!t) throw new EditError("no transcript for this source; run transcribe first");
    return t.words;
  },
});

/** Applies one validated operation and stores the result as a NEW timeline row. */
export const applyEdit = async (p: Principal, projectId: string, opName: string, rawArgs: unknown, baseVersion?: number) => {
  await loadProject(p, projectId, "upload_version");
  const op = opByName(opName);
  if (!op) throw new ErrorHandler(400, `Unknown operation ${opName}. Known: ${EDIT_OPS.map((o) => o.name).join(", ")}`);
  const args = op.args.safeParse(rawArgs ?? {});
  if (!args.success) throw new ErrorHandler(422, `Bad arguments: ${args.error.issues[0]?.path.join(".")} ${args.error.issues[0]?.message}`);
  const cur: any = await latest(projectId);
  if (!cur) throw new ErrorHandler(404, "No timeline yet. Upload media first.");
  if (baseVersion !== undefined && baseVersion !== cur.version) throw new ErrorHandler(409, `Timeline moved on: latest is v${cur.version}, you edited v${baseVersion}`);
  let next: Timeline;
  try { next = await op.run(timelineSchema.parse(cur.doc), args.data, contextFor(projectId)); }
  catch (e: any) { if (e instanceof EditError) throw new ErrorHandler(422, e.message); throw e; }
  try {
    return await ReelTimeline.create({ project: projectId, version: next.version, parent: next.parent, doc: next, createdBy: p.userId, summary: `${opName} ${JSON.stringify(args.data).slice(0, 200)}` });
  } catch (e: any) {
    if (e?.code === 11000) throw new ErrorHandler(409, "Another edit was saved first. Reload and retry.");
    throw e;
  }
};

export const startTranscribe = async (p: Principal, projectId: string, assetId: string, o: { provider?: string; script?: "native" | "roman"; languageHint?: string } = {}) => {
  await loadProject(p, projectId, "upload_version");
  const a = await MediaAsset.findOne({ _id: assetId, project: projectId });
  if (!a) throw new ErrorHandler(404, "Asset not found");
  return createJob({ project: projectId, owner: p.userId, type: "transcribe", input: { assetId, ...o } });
};

export const startRender = async (p: Principal, projectId: string, version: number, quality: "preview" | "final") => {
  await loadProject(p, projectId, "upload_version");
  if (!(await ReelTimeline.findOne({ project: projectId, version }))) throw new ErrorHandler(404, "Timeline version not found");
  return createJob({ project: projectId, owner: p.userId, type: "render", input: { version, quality }, maxAttempts: 1 });
};

export const getJob = async (p: Principal, projectId: string, jobId: string) => {
  await loadProject(p, projectId);
  if (!mongoose.isValidObjectId(jobId)) throw new ErrorHandler(404, "Job not found");
  const j: any = await ReelJob.findOne({ _id: jobId, project: projectId });
  if (!j) throw new ErrorHandler(404, "Job not found");
  return j;
};
export const jobJson = (j: any) => ({ id: String(j._id), type: j.type, state: j.state, progress: j.progress, error: j.error, providerStatus: j.providerStatus, result: j.result, attempts: j.attempts });

/** Registers a finished render as the next ProjectVersion so review, compare and approval just work. */
export const registerRenderAsVersion = async (project: any, renderedFile: string, timelineVersion: number, userId: string) => {
  const existing: any[] = await ProjectVersion.find({ project: project._id }).select("number");
  const number = nextVersionNumber(existing.map((v) => v.number));
  const dir = path.join(storageRoot(), "projects", String(project._id), `v${number}`);
  fs.mkdirSync(dir, { recursive: true });
  const src = path.join(dir, "source.mp4");
  await fs.promises.copyFile(renderedFile, src);
  const v: any = await ProjectVersion.create({
    project: project._id, number, kind: "upload", processing: "pending", uploadedBy: userId,
    sourceKey: path.relative(storageRoot(), src), note: `ReelFlow timeline v${timelineVersion}`,
  });
  await Project.updateOne({ _id: project._id }, { status: statusAfterNewVersion(project.status), currentVersion: number });
  return v;
};

/** Approval of the rendered ProjectVersion locks the timeline row it came from. */
export const approveTimeline = async (p: Principal, projectId: string, version: number) => {
  await loadProject(p, projectId, "approve");
  const row: any = await ReelTimeline.findOne({ project: projectId, version });
  if (!row) throw new ErrorHandler(404, "Timeline version not found");
  if (!row.renders?.length) throw new ErrorHandler(409, "Render this timeline version before approving it");
  row.approved = true; row.approvedBy = p.userId;
  await row.save();
  return row;
};
