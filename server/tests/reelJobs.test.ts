import { describe, it, expect } from "vitest";
import { createFakeModel } from "./helpers/fakeModel";
import { canTransition, registerHandler, runJob, ProviderNotConfigured, NeedsApproval } from "../reel/jobs";
import { ReelJob, ReelTimeline, ApiToken } from "../reel/models";

const mk = async (type: string, extra: any = {}) => {
  const Job: any = createFakeModel({ state: "queued", attempts: 0, maxAttempts: 2, progress: 0 });
  const j = await Job.create({ type, ...extra });
  return { Job, id: String(j._id) };
};

describe("job state machine", () => {
  it("allows only legal transitions", () => {
    expect(canTransition("queued", "running")).toBe(true);
    expect(canTransition("succeeded", "running")).toBe(false);
    expect(canTransition("cancelled", "running")).toBe(false);
  });
});

describe("runJob", () => {
  it("stores the handler result", async () => {
    registerHandler("t_ok", async (_j, p) => { await p(0.5); return { out: 1 }; });
    const { Job, id } = await mk("t_ok");
    const j = await runJob(id, { Job });
    expect([j.state, j.result, j.progress]).toEqual(["succeeded", { out: 1 }, 1]);
  });
  it("retries then fails after maxAttempts", async () => {
    registerHandler("t_bad", async () => { throw new Error("boom"); });
    const { Job, id } = await mk("t_bad");
    expect((await runJob(id, { Job })).state).toBe("queued");
    const j = await runJob(id, { Job });
    expect([j.state, j.error, j.attempts]).toEqual(["failed", "boom", 2]);
  });
  it("provider-not-configured is explicit and not retried", async () => {
    registerHandler("t_prov", async () => { throw new ProviderNotConfigured("Sarvam", "SARVAM_API_KEY"); });
    const { Job, id } = await mk("t_prov");
    const j = await runJob(id, { Job });
    expect([j.state, j.providerStatus, j.attempts]).toEqual(["failed", "not_configured", 1]);
    expect(j.error).toMatch(/SARVAM_API_KEY/);
  });
  it("pauses for approval and skips cancelled jobs", async () => {
    registerHandler("t_appr", async () => { throw new NeedsApproval("confirm publish"); });
    const a = await mk("t_appr");
    expect((await runJob(a.id, { Job: a.Job })).state).toBe("needs_approval");
    const c = await mk("t_ok", { state: "cancelled" });
    expect((await runJob(c.id, { Job: c.Job })).state).toBe("cancelled");
  });
  it("unknown handler fails with a clear error", async () => {
    const { Job, id } = await mk("nope", { maxAttempts: 1 });
    expect((await runJob(id, { Job })).error).toMatch(/no handler/);
  });
});

describe("models", () => {
  it("timeline version is unique per project and doc/version are immutable", () => {
    const idx = (ReelTimeline as any).schema.indexes().find(([k]: any) => k.project && k.version);
    expect(idx?.[1].unique).toBe(true);
    const sc = (ReelTimeline as any).schema; const p = (n: string) => sc.path(n);
    expect(p("doc").options.immutable).toBe(true);
    expect(p("version").options.immutable).toBe(true);
  });
  it("job requires a known type; token hash is unique", () => {
    expect(new (ReelJob as any)({ type: "x" }).validateSync()?.errors.type).toBeTruthy();
    expect((ApiToken as any).schema.path("tokenHash").options.unique).toBe(true);
  });
});
