// BullMQ job that pushes an approved video + AI kit to YouTube or Instagram.
// YouTube schedules natively (publishAt); Instagram has no scheduling API, so it uses a delayed job.
import { Queue, Worker } from "bullmq";
import fs from "fs";
import path from "path";
import { Project, ProjectVersion } from "../models/review.model";
import { PublishKit } from "../models/publishkit.model";
import { Publication, SocialAccount } from "../models/social.model";
import * as yt from "../utils/youtube";
import * as ig from "../utils/instagram";
import { decrypt, encrypt, instagramCaption, signMedia, youtubeMetadata } from "../services/publishLogic";
import { resolveKey, versionDir } from "../utils/storage";
import { toMp4 } from "../utils/transcode";
import { redisConnection } from "./publishKit";
import { logger } from "../utils/logger";

const QUEUE = "publish";
let queue: Queue | null = null;

export const enqueuePublish = async (pubId: string, delayMs = 0) => {
  queue ??= new Queue(QUEUE, { connection: redisConnection() });
  await queue.add("publish", { pubId }, { jobId: pubId, delay: Math.max(0, delayMs), removeOnComplete: true, removeOnFail: 100, attempts: 1 });
};

/** Removes a waiting (delayed) job so Instagram posts do not fire. The worker also ignores canceled rows. */
export const dequeuePublish = async (pubId: string) => {
  queue ??= new Queue(QUEUE, { connection: redisConnection() });
  await (await queue.getJob(pubId))?.remove().catch(() => {});
};

export const startPublishWorker = () => {
  const w = new Worker(QUEUE, (job) => runPublish(job.data.pubId), { connection: redisConnection(), concurrency: 1 });
  w.on("error", (e) => logger.error("publish_worker_error", { errorMessage: e.message }));
  return w;
};

/** Valid access token, refreshing Google tokens when near expiry. Marks the account when re-login is needed. */
export const accessToken = async (acc: any): Promise<string> => {
  if (acc.expiresAt && acc.expiresAt.getTime() > Date.now() + 60_000) return decrypt(acc.accessToken);
  if (acc.provider === "youtube" && acc.refreshToken) {
    try {
      const t = await yt.refresh(decrypt(acc.refreshToken));
      acc.accessToken = encrypt(t.access_token);
      acc.expiresAt = new Date(Date.now() + t.expires_in * 1000);
      await acc.save();
      return t.access_token;
    } catch (e) {
      await SocialAccount.updateOne({ _id: acc._id }, { needsReconnect: true });
      throw new Error("The connected account must be reconnected");
    }
  }
  await SocialAccount.updateOne({ _id: acc._id }, { needsReconnect: true });
  throw new Error("The connected account must be reconnected");
};

export const runPublish = async (pubId: string) => {
  try {
    await publish(pubId);
  } catch (e: any) {
    logger.error("publish_failed", { pubId, errorMessage: e?.message });
    await Publication.updateOne({ _id: pubId }, { status: "failed", error: String(e?.message ?? e).slice(0, 500) });
  }
};

const publish = async (pubId: string) => {
  const pub: any = await Publication.findById(pubId);
  if (!pub || (pub.status !== "queued" && pub.status !== "scheduled")) return;
  const [kit, project, acc]: any[] = await Promise.all([
    PublishKit.findById(pub.kit), Project.findById(pub.project), SocialAccount.findById(pub.account),
  ]);
  const version: any = await ProjectVersion.findOne({ project: pub.project, number: project.currentVersion });
  if (!kit || !acc || !version?.sourceKey) throw new Error("Kit, account or source video is missing");
  // Conditional on the status we read, so a cancel that landed meanwhile wins.
  const claimed: any = await Publication.updateOne({ _id: pubId, status: pub.status }, { status: "publishing", error: undefined });
  if (!claimed.matchedCount) return;
  const token = await accessToken(acc);
  const src = resolveKey(version.sourceKey);
  const thumb = kit.thumbnails?.[kit.chosenThumbnail];

  if (pub.provider === "youtube") {
    const m = youtubeMetadata(kit, version.duration);
    const video = await yt.uploadVideo({
      accessToken: token, file: src, ...m, privacy: pub.privacy || "public", publishAt: pub.scheduledAt ?? undefined,
    });
    // Thumbnail/captions need channel verification/extra quota: failures must not lose the upload.
    const soft = async (what: string, f: () => Promise<unknown>) => f().catch((e) => logger.error(`youtube_${what}_failed`, { pubId, errorMessage: e?.message }));
    if (thumb) await soft("thumbnail", async () => yt.setThumbnail(token, video.id, await fs.promises.readFile(resolveKey(thumb.key))));
    if (kit.srt) await soft("captions", () => yt.uploadCaptions(token, video.id, kit.srt));
    await Publication.updateOne({ _id: pubId }, {
      status: pub.scheduledAt ? "scheduled" : "published", externalId: video.id, url: `https://www.youtube.com/watch?v=${video.id}`,
    });
  } else {
    const base = process.env.PUBLIC_API_URL;
    if (!base || !base.startsWith("https://")) throw new Error("Instagram needs PUBLIC_API_URL set to a public https URL");
    const mp4 = path.join(versionDir(String(project._id), version.number), "ig.mp4");
    if (!fs.existsSync(mp4)) await toMp4(src, mp4);
    const url = (kind: "video" | "cover") => `${base.replace(/\/$/, "")}/v1/public-media/${pubId}/${kind}?t=${signMedia(pubId, kind)}`;
    const r = await ig.publishReel({ token, igId: acc.externalId, videoUrl: url("video"), coverUrl: thumb ? url("cover") : undefined, caption: instagramCaption(kit) });
    await Publication.updateOne({ _id: pubId }, { status: "published", externalId: r.id, url: r.url });
  }
  await Project.updateOne({ _id: project._id, status: "approved" }, { status: "published" });
};
