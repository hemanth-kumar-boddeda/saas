// Pure publish-kit rules: AI JSON schemas + tolerant parsing, SRT, chapters.
// No DB, HTTP or SDK here so everything is unit-testable (tests/publishKitLogic.test.ts).
import { z } from "zod";

export const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const brandKit = z.object({ primary: hex, secondary: hex, accent: hex });
export const channelInput = z.object({
  name: z.string().trim().min(1).max(80),
  niche: z.string().trim().max(200).default(""),
  tone: z.string().trim().max(200).default(""),
  brand: brandKit.default({ primary: "#111827", secondary: "#f9fafb", accent: "#facc15" }),
});
export type ChannelProfile = z.infer<typeof channelInput>;

export const frameRanking = z.object({
  rankings: z
    .array(z.object({ index: z.number().int().min(0), score: z.number().min(0).max(100), reason: z.string().max(300) }))
    .min(1),
});

const chapter = z.object({ start: z.number().min(0), title: z.string().trim().min(1).max(100) });
export const copyOutput = z.object({
  titles: z.array(z.string().trim().min(1).max(100)).length(3),
  description: z.string().trim().min(1).max(5000),
  chapters: z.array(chapter).max(30),
});
export const tagsOutput = z.object({
  hashtags: z.array(z.string().trim().min(1).max(40)).min(1).max(15),
  tags: z.array(z.string().trim().min(1).max(60)).min(1).max(30),
  thumbnailTexts: z.array(z.string().trim().min(1).max(28)).length(3),
});

/** Fields the owner may edit before publishing. Everything is optional (PATCH). */
export const kitEdit = z
  .object({
    titles: copyOutput.shape.titles,
    chosenTitle: z.number().int().min(0).max(2),
    description: copyOutput.shape.description,
    chapters: copyOutput.shape.chapters,
    hashtags: tagsOutput.shape.hashtags,
    tags: tagsOutput.shape.tags,
    srt: z.string().max(500_000),
    chosenThumbnail: z.number().int().min(0).max(2),
  })
  .partial();

/**
 * Pulls the first JSON object out of model text (handles ```json fences and
 * chatter around it) and validates it. Returns a readable error so the caller
 * can feed it back to the model on retry.
 */
export const parseModelJson = <T extends z.ZodTypeAny>(
  text: string,
  schema: T
): { ok: true; data: z.infer<T> } | { ok: false; error: string } => {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "no JSON object found" };
  let raw: unknown;
  try {
    raw = JSON.parse(body.slice(start, end + 1));
  } catch (e: any) {
    return { ok: false, error: `invalid JSON: ${e.message}` };
  }
  const r = schema.safeParse(raw);
  return r.success
    ? { ok: true, data: r.data }
    : { ok: false, error: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ") };
};

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export const srtTime = (sec: number) => {
  const ms = Math.round(Math.max(0, sec) * 1000);
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};

export interface Segment { start: number; end: number; text: string }

export const toSrt = (segments: Segment[]) =>
  segments
    .filter((s) => s.text.trim() && s.end > s.start)
    .map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text.trim()}\n`)
    .join("\n");

/** YouTube chapter lines. YouTube needs the first chapter at 0:00 and >= 3 chapters. */
export const chapterLines = (chapters: { start: number; title: string }[], duration: number) => {
  const sorted = [...chapters]
    .filter((c) => c.start >= 0 && c.start < duration)
    .sort((a, b) => a.start - b.start);
  if (sorted.length && sorted[0].start > 0) sorted.unshift({ start: 0, title: "Intro" });
  const stamp = (s: number) => {
    const t = Math.floor(s);
    const h = Math.floor(t / 3600);
    return h ? `${h}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}` : `${Math.floor(t / 60)}:${pad(t % 60)}`;
  };
  return sorted.map((c) => `${stamp(c.start)} ${c.title}`);
};

/** Frame indexes by descending score, dropping out-of-range and duplicate indexes. */
export const bestFrames = (rankings: { index: number; score: number }[], frameCount: number, take = 3) => {
  const seen = new Set<number>();
  return [...rankings]
    .sort((a, b) => b.score - a.score)
    .filter((r) => r.index < frameCount && !seen.has(r.index) && !!seen.add(r.index))
    .slice(0, take);
};

/** Trims a transcript for prompts. ponytail: head-only cut; chunk+summarise if long videos matter. */
export const clipTranscript = (text: string, max = 60_000) => (text.length > max ? text.slice(0, max) + " …[truncated]" : text);

/** Channel profile as a system-prompt block, injected into every AI call. */
export const channelContext = (c: Partial<ChannelProfile> | null | undefined) =>
  c
    ? `Channel profile\n- Name: ${c.name}\n- Niche: ${c.niche || "unspecified"}\n- Tone of voice: ${c.tone || "unspecified"}\n- Brand colors: ${c.brand ? `${c.brand.primary}, ${c.brand.secondary}, ${c.brand.accent}` : "unspecified"}`
    : "Channel profile: none set. Use a clear, friendly, neutral tone.";
