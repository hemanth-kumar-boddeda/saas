import { describe, it, expect, vi, beforeEach } from "vitest";

const m = await vi.hoisted(async () => {
  const { createFakeModel } = await import("./helpers/fakeModel");
  return { ProjectVersion: createFakeModel(), PublishKit: createFakeModel({ status: "queued" }) };
});
vi.mock("../models/review.model", () => ({ ProjectVersion: m.ProjectVersion }));
vi.mock("../models/publishkit.model", () => ({ PublishKit: m.PublishKit }));
const enqueue = vi.hoisted(() => vi.fn());
vi.mock("../jobs/publishKit", () => ({ enqueueKit: enqueue }));

import { autoStartKit } from "../jobs/autoKit";

beforeEach(() => {
  m.ProjectVersion.rows.length = 0;
  m.PublishKit.rows.length = 0;
  enqueue.mockReset().mockResolvedValue(undefined);
});
const version = (o: any = {}) => m.ProjectVersion.create({ project: "p1", number: 1, kind: "upload", processing: "ready", ...o });

describe("autoStartKit", () => {
  it("queues a kit for a ready upload", async () => {
    await version();
    expect(await autoStartKit("p1", 1)).toBe(true);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(m.PublishKit.rows).toHaveLength(1);
  });
  it("skips pasted links and unready uploads", async () => {
    await version({ kind: "link" });
    expect(await autoStartKit("p1", 1)).toBe(false);
    m.ProjectVersion.rows[0].kind = "upload";
    m.ProjectVersion.rows[0].processing = "pending";
    expect(await autoStartKit("p1", 1)).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("does not duplicate a kit for the same version, but retries after failure", async () => {
    const v = await version();
    expect(await autoStartKit("p1", 1)).toBe(true);
    expect(await autoStartKit("p1", 1)).toBe(false);
    m.PublishKit.rows[0].status = "failed";
    expect(await autoStartKit("p1", 1)).toBe(true);
    expect(v).toBeTruthy();
  });
  it("never throws when the queue is down", async () => {
    await version();
    enqueue.mockRejectedValue(new Error("down"));
    expect(await autoStartKit("p1", 1)).toBe(false);
  });
});
