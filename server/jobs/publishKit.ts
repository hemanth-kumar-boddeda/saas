// BullMQ job: transcribe -> frames -> AI copy -> thumbnails. Runs in the API process
// (concurrency 1: ffmpeg + ONNX are heavy). ponytail: split into a worker process when load needs it.
import { Queue, Worker } from "bullmq";
import fs from "fs";
import path from "path";
import { Project, ProjectVersion } from "../models/review.model";
import { Channel, PublishKit } from "../models/publishkit.model";
import { askJson, transcribe, MODELS } from "../utils/ai";
import { extractAudio, sampleFrames, frameAt, frameTimes } from "../utils/transcode";
import { textOnFrame, cutout, tintedTop } from "../utils/thumbnail";
import { resolveKey, versionDir } from "../utils/storage";
import { logger } from "../utils/logger";
import {
  frameRanking, copyOutput, tagsOutput, bestFrames, toSrt, clipTranscript, channelContext,
} from "../services/publishKitLogic";

const QUEUE = "publish-kit";

export const redisConnection = () => {
  const u = new URL(process.env.REDIS_URL as string);
  return {
    host: u.hostname, port: Number(u.port) || 6379,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    tls: u.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null as null,
  };
};

let queue: Queue | null = null;
export const enqueueKit = async (kitId: string) => {
  queue ??= new Queue(QUEUE, { connection: redisConnection() });
  await queue.add("kit", { kitId }, { jobId: kitId, removeOnComplete: true, removeOnFail: 100 });
};

export const startKitWorker = () => {
  const w = new Worker(QUEUE, (job) => runKit(job.data.kitId), { connection: redisConnection(), concurrency: 1 });
  w.on("error", (e) => logger.error("kit_worker_error", { errorMessage: e.message }));
  return w;
};

const step = (kitId: string, s: string) => PublishKit.updateOne({ _id: kitId }, { status: "running", step: s });

export const runKit = async (kitId: string) => {
  try {
    await pipeline(kitId);
  } catch (e: any) {
    logger.error("kit_failed", { kitId, errorMessage: e?.message });
    await PublishKit.updateOne({ _id: kitId }, { status: "failed", error: String(e?.message ?? e).slice(0, 500) });
  }
};

const pipeline = async (kitId: string) => {
  const kit: any = await PublishKit.findById(kitId);
  const version: any = await ProjectVersion.findById(kit.version);
  const project: any = await Project.findById(kit.project);
  const channel: any = project.channel ? await Channel.findById(project.channel).lean() : null;
  if (!version?.sourceKey) throw new Error("This version has no uploaded video to analyse");
  const src = resolveKey(version.sourceKey);
  const dir = path.join(versionDir(String(project._id), version.number), "kit");
  fs.mkdirSync(dir, { recursive: true });
  const ctx = channelContext(channel);
  const brand = { primary: "#111827", secondary: "#ffffff", accent: "#facc15", ...(channel?.brand ?? {}) };

  await step(kitId, "transcribing");
  const audio = path.join(dir, "audio.mp3");
  await extractAudio(src, audio);
  const { text, segments } = await transcribe(audio);
  await fs.promises.rm(audio, { force: true });
  await PublishKit.updateOne({ _id: kitId }, { transcript: text, segments, srt: toSrt(segments) });

  await step(kitId, "ranking_frames");
  const frameFiles = await sampleFrames(src, version.duration, path.join(dir, "frames"));
  const ranked = await askJson(frameRanking, {
    model: MODELS.smart,
    system: `You pick YouTube/Instagram thumbnail frames. Score each frame 0-100 on: clear face, expression, composition, sharpness. ${ctx}`,
    user: `There are ${frameFiles.length} frames, indexed 0-${frameFiles.length - 1}. Return {"rankings":[{"index":number,"score":number,"reason":string}]} for every frame.`,
    images: await Promise.all(frameFiles.map((f) => fs.promises.readFile(f))),
    maxTokens: 2048,
  });
  const top = bestFrames(ranked.rankings, frameFiles.length, 3);
  if (!top.length) throw new Error("AI ranking returned no usable frames");

  await step(kitId, "writing_copy");
  const transcript = clipTranscript(text);
  const [copy, extras] = await Promise.all([
    askJson(copyOutput, {
      model: MODELS.smart,
      system: `You are a YouTube/Instagram strategist. Write honest, specific copy; never promise views or virality. ${ctx}`,
      user: `Video length: ${Math.round(version.duration)}s. Transcript:\n${transcript}\n\nReturn {"titles":[3 distinct options],"description":string,"chapters":[{"start":seconds,"title":string}]}. Chapters must use real transcript timing, start at 0.`,
    }),
    askJson(tagsOutput, {
      model: MODELS.fast,
      system: `You write short metadata for videos. ${ctx}`,
      user: `Transcript:\n${transcript}\n\nReturn {"hashtags":["#tag"...],"tags":["keyword"...],"thumbnailTexts":[3 bold phrases, max 4 words each]}.`,
      maxTokens: 1024,
    }),
  ]);

  await step(kitId, "building_thumbnails");
  const times = frameTimes(version.duration);
  const hi = await Promise.all(
    top.map(async (t) => {
      const f = path.join(dir, `hi_${t.index}.jpg`);
      await frameAt(src, times[t.index], f, 1280);
      return fs.promises.readFile(f);
    })
  );
  const second = hi[1] ?? hi[0];
  const cut = await cutout(hi[0], extras.thumbnailTexts[1], brand);
  const variants = [
    { label: "Best frame", text: extras.thumbnailTexts[0], img: await textOnFrame(hi[0], extras.thumbnailTexts[0], brand), score: top[0].score },
    { label: cut.usedCutout ? "Cut-out on brand gradient" : "Frame on brand gradient", text: extras.thumbnailTexts[1], img: cut.image, score: top[0].score - (cut.usedCutout ? 0 : 5) },
    { label: "Alternate frame", text: extras.thumbnailTexts[2], img: await tintedTop(second, extras.thumbnailTexts[2], brand), score: (top[1] ?? top[0]).score },
  ];
  const thumbnails = [];
  for (const [i, v] of variants.entries()) {
    const file = path.join(dir, `thumb_${i}.jpg`);
    await fs.promises.writeFile(file, v.img);
    thumbnails.push({ key: path.relative(path.resolve(process.env.STORAGE_DIR || "storage"), file), label: v.label, text: v.text, score: Math.max(0, Math.round(v.score)) });
  }
  await fs.promises.rm(path.join(dir, "frames"), { recursive: true, force: true });

  await PublishKit.updateOne({ _id: kitId }, {
    status: "ready", step: "done", error: undefined, titles: copy.titles, description: copy.description,
    chapters: copy.chapters, hashtags: extras.hashtags, tags: extras.tags, thumbnails,
  });
};
