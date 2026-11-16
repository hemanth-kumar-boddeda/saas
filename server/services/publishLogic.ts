// Pure publishing rules: input validation, platform metadata, token crypto, OAuth state.
// No DB/HTTP so everything is unit-tested (tests/publishLogic.test.ts).
import crypto from "crypto";
import { z } from "zod";
import { chapterLines } from "./publishKitLogic";

export const MIN_LEAD_MS = 15 * 60 * 1000; // YouTube/IG need a real lead time
export const MAX_LEAD_MS = 180 * 24 * 3600 * 1000;

export const publishInput = z
  .object({
    provider: z.enum(["youtube", "instagram"]),
    accountId: z.string().regex(/^[0-9a-f]{24}$/),
    scheduledAt: z.string().datetime().optional(),
    privacy: z.enum(["public", "unlisted", "private"]).default("public"), // YouTube only
  })
  .strict();
export type PublishInput = z.infer<typeof publishInput>;

/** Returns the schedule Date, or null for "now". Throws a plain Error on a bad time. */
export const resolveSchedule = (iso: string | undefined, now = Date.now()): Date | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (t < now + MIN_LEAD_MS) throw new Error("Schedule at least 15 minutes from now");
  if (t > now + MAX_LEAD_MS) throw new Error("Schedule at most 180 days ahead");
  return new Date(t);
};

export interface KitLike {
  titles: string[]; chosenTitle: number; description: string;
  chapters: { start: number; title: string }[]; hashtags: string[]; tags: string[];
}

const clean = (h: string) => "#" + h.replace(/^#+/, "").replace(/\s+/g, "");

/** YouTube limits: title 100, description 5000 bytes, tags 500 chars total. */
export const youtubeMetadata = (k: KitLike, duration: number) => {
  const chapters = chapterLines(k.chapters, duration);
  const parts = [k.description.trim()];
  if (chapters.length >= 3) parts.push(chapters.join("\n")); // YouTube ignores chapters below 3
  if (k.hashtags.length) parts.push(k.hashtags.slice(0, 15).map(clean).join(" "));
  let description = parts.join("\n\n");
  while (Buffer.byteLength(description) > 5000) description = description.slice(0, -50);
  let used = 0;
  const tags = k.tags.filter((t) => (used += t.length + 1) <= 500);
  return { title: (k.titles[k.chosenTitle] ?? k.titles[0]).slice(0, 100), description, tags };
};

/** Instagram: caption 2200 chars, max 30 hashtags. */
export const instagramCaption = (k: KitLike) => {
  const tags = k.hashtags.slice(0, 30).map(clean).join(" ");
  const title = k.titles[k.chosenTitle] ?? k.titles[0];
  const room = 2200 - tags.length - title.length - 4;
  return `${title}\n\n${k.description.trim().slice(0, Math.max(0, room))}\n\n${tags}`.trim().slice(0, 2200);
};

// ---- token encryption (AES-256-GCM) ----
const key = () =>
  crypto.createHash("sha256").update(process.env.TOKEN_ENC_KEY || `${process.env.ACCESS_TOKEN}:social`).digest();

export const encrypt = (plain: string) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
};
export const decrypt = (blob: string) => {
  const raw = Buffer.from(blob, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
};

// ---- OAuth state: binds the callback to the user who started it ----
const stateMac = (b: string) => crypto.createHmac("sha256", key()).update(b).digest("base64url");
export const signState = (userId: string, provider: string, now = Date.now()) => {
  const b = Buffer.from(JSON.stringify({ u: userId, p: provider, e: now + 10 * 60 * 1000, n: crypto.randomBytes(8).toString("hex") })).toString("base64url");
  return `${b}.${stateMac(b)}`;
};
export const verifyState = (state: unknown, provider: string, now = Date.now()): string | null => {
  if (typeof state !== "string") return null;
  const [b, mac] = state.split(".");
  if (!b || !mac) return null;
  const want = Buffer.from(stateMac(b));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(b, "base64url").toString());
    return s.p === provider && s.e > now ? String(s.u) : null;
  } catch {
    return null;
  }
};

/** Signed, short-lived URL token letting Meta fetch one publication's media. */
export const signMedia = (pubId: string, kind: "video" | "cover", ttl = 3600, now = Date.now()) => {
  const b = Buffer.from(JSON.stringify({ p: pubId, k: kind, e: now + ttl * 1000 })).toString("base64url");
  return `${b}.${stateMac(b)}`;
};
export const verifyMedia = (t: unknown, pubId: string, kind: string, now = Date.now()) => {
  if (typeof t !== "string") return false;
  const [b, mac] = t.split(".");
  if (!b || !mac) return false;
  const want = Buffer.from(stateMac(b));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return false;
  try {
    const s = JSON.parse(Buffer.from(b, "base64url").toString());
    return s.p === pubId && s.k === kind && s.e > now;
  } catch {
    return false;
  }
};
