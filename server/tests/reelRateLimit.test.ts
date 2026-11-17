// Regression for a bug found by driving the real UI: /v1/reel shared the 10/min auth limiter and 429'd on page load.
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { makeReelPlanLimiter, reelIpLimiter } from "../middleware/rateLimit";

describe("reel rate limits", () => {
  it("an editor session (polling every 1.5 s plus page loads) is never limited", async () => {
    const app = express(); app.use(reelIpLimiter); app.get("/x", (_q, r) => void r.send("ok"));
    const codes = new Set<number>();
    for (let i = 0; i < 60; i++) codes.add((await request(app).get("/x")).status); // one minute of 1.5 s polling is 40 requests
    expect([...codes]).toEqual([200]);
  });
  it("plan limit is per principal: token users do not share an 'anon' bucket", async () => {
    const app = express();
    app.use((req, _r, n) => { (req as any).reel = { userId: String(req.headers["x-u"]) }; n(); });
    app.post("/p", makeReelPlanLimiter(2), (_q, r) => void r.send("ok"));
    const hit = (u: string) => request(app).post("/p").set("x-u", u).then((r) => r.status);
    expect([await hit("a"), await hit("a"), await hit("a")]).toEqual([200, 200, 429]);
    expect(await hit("b")).toBe(200);
  });
});

import { queueJobId } from "../reel/queue";
describe("queue job ids", () => {
  it("never contain a colon (BullMQ rejects them; the mocked queue hid this until the UI hit it)", () => {
    expect(queueJobId("65f0c0ffee65f0c0ffee0001", 1700000000000)).not.toContain(":");
  });
});
