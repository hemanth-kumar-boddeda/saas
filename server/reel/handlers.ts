// Job handlers: the only code that runs ffmpeg / ASR for jobs. Registered once at startup.
import fs from "fs";
import os from "os";
import path from "path";
import { ProjectVersion, Project } from "../models/review.model";
import { resolveKey, storageRoot } from "../utils/storage";
import { extractAudio, toHls } from "../utils/transcode";
import { logger } from "../utils/logger";
import { pickAsr } from "./asr";
import { registerHandler } from "./jobs";
import { MediaAsset, ReelTimeline, Transcript, UsageEvent } from "./models";
import { ffmpegProvider } from "./render/ffmpeg";
import { timelineSchema, totalDuration } from "./schema";
import { registerRenderAsVersion } from "./operations";

export const registerReelHandlers = () => {
  registerHandler("transcribe", async (job, progress) => {
    const { assetId, provider, script, languageHint } = job.input;
    const asset: any = await MediaAsset.findById(assetId);
    if (!asset) throw new Error("asset not found");
    const asr = pickAsr(provider);
    if (!asr.configured()) { const { ProviderNotConfigured } = await import("./jobs"); throw new ProviderNotConfigured(asr.name, asr.envVar); }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "asr-"));
    try {
      const audio = path.join(dir, "audio.wav");
      await extractAudio(resolveKey(asset.storageKey), audio);
      await progress(0.2);
      const r = await asr.transcribe(audio, { script, languageHint });
      await Transcript.create({ asset: asset._id, project: asset.project, provider: r.provider, model: r.model, language: r.language, script: r.script, text: r.text, words: r.words });
      await UsageEvent.create({ owner: job.owner, project: job.project, kind: "asr_seconds", units: asset.duration, provider: r.provider, jobId: job._id }); // costUsd left unset: price unknown
      return { words: r.words.length, provider: r.provider, model: r.model, language: r.language };
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  registerHandler("render", async (job, progress) => {
    const { version, quality } = job.input;
    const row: any = await ReelTimeline.findOne({ project: job.project, version });
    if (!row) throw new Error("timeline version not found");
    const t = timelineSchema.parse(row.doc);
    const out = path.join(os.tmpdir(), `reel-${job._id}.mp4`);
    const work = path.join(os.tmpdir(), `reel-${job._id}-work`);
    try {
      const res = await ffmpegProvider.render(t, { quality, outFile: out, workDir: work, resolveSource: resolveKey, onProgress: progress });
      const project: any = await Project.findById(job.project);
      const v: any = await registerRenderAsVersion(project, out, version, String(job.owner));
      const dir = path.join(storageRoot(), "projects", String(project._id), `v${v.number}`);
      await toHls(path.join(dir, "source.mp4"), path.join(dir, "hls"));
      await ProjectVersion.updateOne({ _id: v._id }, { processing: "ready", duration: res.measured.duration, hlsKey: path.relative(storageRoot(), path.join(dir, "hls")) });
      row.renders.push({ quality, storageKey: path.relative(storageRoot(), path.join(dir, "source.mp4")), projectVersion: v.number, at: new Date() });
      await row.save();
      await UsageEvent.create({ owner: job.owner, project: job.project, kind: "render_seconds", units: res.renderSeconds, provider: "ffmpeg", jobId: job._id });
      logger.info("reel_render_done", { jobId: String(job._id), version, outSeconds: totalDuration(t) });
      return { projectVersion: v.number, measured: res.measured, renderSeconds: res.renderSeconds };
    } finally { fs.rmSync(out, { force: true }); fs.rmSync(work, { recursive: true, force: true }); }
  });
};
