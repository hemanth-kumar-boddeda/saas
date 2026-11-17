// Persistent job runner. State lives in the ReelJob row, so a crash or restart never loses it.
// BullMQ (or a direct call in tests) only triggers `runJob(id)`; the row is the source of truth.
import { ReelJob } from "./models";

export class ProviderNotConfigured extends Error {
  constructor(public provider: string, public envVar: string) {
    super(`${provider} is not configured: set ${envVar}`);
  }
}
/** Thrown by a handler to pause until a human approves. */
export class NeedsApproval extends Error {}

export type JobState = "queued" | "running" | "succeeded" | "failed" | "needs_approval" | "cancelled";
const ALLOWED: Record<JobState, JobState[]> = {
  queued: ["running", "cancelled"],
  running: ["succeeded", "failed", "needs_approval", "queued"], // queued = retry
  needs_approval: ["queued", "cancelled"],
  succeeded: [], failed: ["queued"], cancelled: [],
};
export const canTransition = (from: JobState, to: JobState) => ALLOWED[from].includes(to);

export type Handler = (job: any, progress: (p: number) => Promise<void>) => Promise<unknown>;
const handlers = new Map<string, Handler>();
export const registerHandler = (type: string, h: Handler) => handlers.set(type, h);

export const createJob = (o: { project: string; owner: string; type: string; input?: unknown; maxAttempts?: number }) =>
  ReelJob.create({ ...o, state: "queued" });

/** Runs one attempt. Returns the final row. Retries re-queue until maxAttempts. */
export const runJob = async (id: string, deps: { Job?: typeof ReelJob; sleep?: (ms: number) => Promise<void> } = {}) => {
  const Job = deps.Job ?? ReelJob;
  const job: any = await Job.findById(id);
  if (!job) throw new Error("job not found");
  if (!canTransition(job.state, "running")) return job; // cancelled or already done
  const h = handlers.get(job.type);
  Object.assign(job, { state: "running", startedAt: new Date(), attempts: job.attempts + 1, error: undefined });
  await job.save();
  const progress = async (p: number) => { job.progress = Math.max(0, Math.min(1, p)); await job.save(); };
  try {
    if (!h) throw new Error(`no handler for job type ${job.type}`);
    job.result = await h(job, progress);
    Object.assign(job, { state: "succeeded", progress: 1, finishedAt: new Date() });
  } catch (e: any) {
    if (e instanceof ProviderNotConfigured) {
      // not retryable: retrying cannot create a key
      Object.assign(job, { state: "failed", providerStatus: "not_configured", error: e.message, finishedAt: new Date() });
    } else if (e instanceof NeedsApproval) {
      Object.assign(job, { state: "needs_approval", error: e.message });
    } else if (job.attempts < job.maxAttempts) {
      Object.assign(job, { state: "queued", error: String(e.message).slice(0, 500) });
    } else {
      Object.assign(job, { state: "failed", error: String(e.message).slice(0, 500), finishedAt: new Date() });
    }
  }
  await job.save();
  return job;
};
