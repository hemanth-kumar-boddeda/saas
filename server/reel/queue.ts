// BullMQ trigger for persistent ReelJob rows. The row (not Redis) is the source of truth, so a lost
// queue entry can be re-enqueued from the DB. Concurrency 1: renders are CPU heavy.
// ponytail: runs in the API process; split into a worker process before hosted use.
import { Queue, Worker } from "bullmq";
import { redisConnection } from "../jobs/publishKit";
import { logger } from "../utils/logger";
import { runJob } from "./jobs";
import { ReelJob } from "./models";
import { registerReelHandlers } from "./handlers";

const QUEUE = "reel-jobs";
/** BullMQ rejects custom ids containing ":" (found live: transcribe and render returned 500). */
export const queueJobId = (jobId: string, now = Date.now()) => `${jobId}-${now}`;
let queue: Queue | null = null;
export const enqueueJob = async (jobId: string) => {
  queue ??= new Queue(QUEUE, { connection: redisConnection() });
  await queue.add("run", { jobId }, { jobId: queueJobId(jobId), removeOnComplete: true, removeOnFail: 100 });
};

export const startReelWorker = async () => {
  registerReelHandlers();
  const w = new Worker(QUEUE, async (j) => {
    const row: any = await runJob(j.data.jobId);
    if (row.state === "queued") await enqueueJob(j.data.jobId); // retry
  }, { connection: redisConnection(), concurrency: 1 });
  w.on("error", (e) => logger.error("reel_worker_error", { errorMessage: e.message }));
  // recover jobs that were queued or running when the process died
  const stuck: any[] = await ReelJob.find({ state: { $in: ["queued", "running"] } });
  for (const j of stuck) { if (j.state === "running") { j.state = "queued"; await j.save(); } await enqueueJob(String(j._id)); }
  return w;
};
