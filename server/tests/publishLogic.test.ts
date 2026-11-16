import { describe, it, expect } from "vitest";
import {
  publishInput, resolveSchedule, youtubeMetadata, instagramCaption, encrypt, decrypt,
  signState, verifyState, signMedia, verifyMedia, MIN_LEAD_MS,
} from "../services/publishLogic";

const kit = (o: any = {}) => ({
  titles: ["T1", "T2", "T3"], chosenTitle: 1, description: "Desc",
  chapters: [{ start: 0, title: "A" }, { start: 30, title: "B" }, { start: 60, title: "C" }],
  hashtags: ["a", "#b"], tags: ["x", "y"], ...o,
});
const id = "a".repeat(24);

describe("publishInput", () => {
  it("accepts valid and defaults privacy", () => {
    expect(publishInput.parse({ provider: "youtube", accountId: id }).privacy).toBe("public");
  });
  it("rejects bad provider, id, date and extra keys", () => {
    expect(publishInput.safeParse({ provider: "tiktok", accountId: id }).success).toBe(false);
    expect(publishInput.safeParse({ provider: "youtube", accountId: "x" }).success).toBe(false);
    expect(publishInput.safeParse({ provider: "youtube", accountId: id, scheduledAt: "tomorrow" }).success).toBe(false);
    expect(publishInput.safeParse({ provider: "youtube", accountId: id, evil: 1 }).success).toBe(false);
  });
});

describe("resolveSchedule", () => {
  const now = 1_000_000_000_000;
  it("null means now", () => expect(resolveSchedule(undefined, now)).toBeNull());
  it("enforces lead time and horizon", () => {
    expect(() => resolveSchedule(new Date(now + MIN_LEAD_MS - 1000).toISOString(), now)).toThrow(/15 minutes/);
    expect(() => resolveSchedule(new Date(now + 200 * 86400000).toISOString(), now)).toThrow(/180/);
    expect(resolveSchedule(new Date(now + MIN_LEAD_MS + 1000).toISOString(), now)).toBeInstanceOf(Date);
  });
});

describe("youtubeMetadata", () => {
  it("uses chosen title, appends chapters and normalised hashtags", () => {
    const m = youtubeMetadata(kit(), 120);
    expect(m.title).toBe("T2");
    expect(m.description).toContain("0:00 A");
    expect(m.description).toContain("#a #b");
  });
  it("omits chapters when fewer than 3", () => {
    expect(youtubeMetadata(kit({ chapters: [{ start: 0, title: "A" }] }), 120).description).not.toContain("0:00");
  });
  it("caps title, description bytes and tag length", () => {
    const m = youtubeMetadata(kit({ titles: ["x".repeat(200)], chosenTitle: 0, description: "é".repeat(4000), tags: Array(100).fill("tagtagtag") }), 120);
    expect(m.title.length).toBe(100);
    expect(Buffer.byteLength(m.description)).toBeLessThanOrEqual(5000);
    expect(m.tags.join(",").length).toBeLessThanOrEqual(500);
  });
});

describe("instagramCaption", () => {
  it("stays within 2200 chars and 30 hashtags", () => {
    const c = instagramCaption(kit({ description: "d".repeat(5000), hashtags: Array.from({ length: 50 }, (_, i) => `h${i}`) }));
    expect(c.length).toBeLessThanOrEqual(2200);
    expect(c.match(/#/g)!.length).toBe(30);
  });
});

describe("crypto + signed tokens", () => {
  it("round-trips and randomises ciphertext", () => {
    const a = encrypt("secret-token");
    expect(a).not.toContain("secret");
    expect(decrypt(a)).toBe("secret-token");
    expect(encrypt("secret-token")).not.toBe(a);
  });
  it("rejects tampered ciphertext", () => {
    const raw = Buffer.from(encrypt("x"), "base64");
    raw[raw.length - 1] ^= 1;
    expect(() => decrypt(raw.toString("base64"))).toThrow();
  });
  it("state binds user+provider and expires", () => {
    const s = signState("u1", "youtube", 1000);
    expect(verifyState(s, "youtube", 2000)).toBe("u1");
    expect(verifyState(s, "instagram", 2000)).toBeNull();
    expect(verifyState(s, "youtube", 1000 + 11 * 60 * 1000)).toBeNull();
    expect(verifyState(s.slice(0, -2) + "xx", "youtube", 2000)).toBeNull();
    expect(verifyState(undefined, "youtube")).toBeNull();
  });
  it("media token binds publication and kind", () => {
    const t = signMedia("p1", "video", 60, 0);
    expect(verifyMedia(t, "p1", "video", 1000)).toBe(true);
    expect(verifyMedia(t, "p2", "video", 1000)).toBe(false);
    expect(verifyMedia(t, "p1", "cover", 1000)).toBe(false);
    expect(verifyMedia(t, "p1", "video", 61_000)).toBe(false);
  });
});
