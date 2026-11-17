// Canonical ReelFlow timeline, schemaVersion 1. Renderer-neutral: no vendor JSON is stored here.
// Times are seconds. Media clips: duration === out - in (speed 1). Caption word times are
// timeline-absolute. Keyframe t is relative to clip start.
import { z } from "zod";

export const SCHEMA_VERSION = 1;
const EPS = 1e-6;
const num = z.number().finite();

const sourceSchema = z.object({
  storageKey: z.string().min(1),
  duration: num.positive(),
  width: num.positive().optional(),
  height: num.positive().optional(),
  hasAudio: z.boolean().default(true),
  language: z.string().optional(),
  offset: num.default(0), // multicam sync: source time = common time + offset
});

const keyframeSchema = z.object({
  t: num.min(0),
  prop: z.enum(["x", "y", "scale", "rotation", "opacity", "gainDb"]),
  value: num,
  ease: z.enum(["linear", "easeIn", "easeOut", "easeInOut"]).default("linear"),
});

const wordSchema = z.object({
  w: z.string(),
  roman: z.string().optional(),
  start: num.min(0),
  end: num.min(0),
  speaker: z.string().optional(),
  lang: z.string().optional(),
});

const captionStyle = z.object({
  script: z.enum(["native", "roman"]).default("native"),
  font: z.string().default("sans"),
  size: num.positive().default(64),
  color: z.string().default("#ffffff"),
  highlight: z.string().default("#ffd400"),
  position: z.enum(["top", "middle", "bottom"]).default("bottom"),
});

export const clipSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().optional(),
  start: num.min(0),
  duration: num.positive(),
  in: num.min(0).optional(),
  out: num.min(0).optional(),
  group: z.string().optional(), // linked clips (video+audio) move together
  transform: z.object({
    x: num.default(0), y: num.default(0), scale: num.positive().default(1), rotation: num.default(0),
    crop: z.object({ x: num.min(0).max(1), y: num.min(0).max(1), w: num.gt(0).max(1), h: num.gt(0).max(1) }).optional(),
  }).optional(),
  keyframes: z.array(keyframeSchema).optional(),
  transition: z.object({ type: z.enum(["cut", "fade", "xfade"]), duration: num.min(0) }).optional(),
  audio: z.object({
    gainDb: num.default(0), fadeIn: num.min(0).default(0), fadeOut: num.min(0).default(0),
    enhance: z.enum(["dialogue"]).optional(),
  }).optional(),
  words: z.array(wordSchema).optional(), // caption cue
  captionStyle: captionStyle.optional(),
  text: z.object({ value: z.string().min(1), size: num.positive().default(64), color: z.string().default("#ffffff") }).optional(),
});

export const trackSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["video", "audio", "caption", "overlay"]),
  clips: z.array(clipSchema),
});

export const timelineSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  project: z.string().min(1),
  version: z.number().int().min(1),
  parent: z.number().int().min(1).nullable(),
  approved: z.boolean().default(false),
  output: z.object({ width: num.positive(), height: num.positive(), fps: num.positive() }),
  sources: z.record(z.string(), sourceSchema),
  tracks: z.array(trackSchema),
});

export type Clip = z.infer<typeof clipSchema>;
export type Track = z.infer<typeof trackSchema>;
export type Timeline = z.infer<typeof timelineSchema>;
export type Word = z.infer<typeof wordSchema>;
export type Source = z.infer<typeof sourceSchema>;

export const clipEnd = (c: Clip) => c.start + c.duration;
export const totalDuration = (t: Timeline) =>
  t.tracks.reduce((m, tr) => tr.clips.reduce((mm, c) => Math.max(mm, clipEnd(c)), m), 0);

/** Returns every violated invariant; empty array means valid. Never throws. */
export const validate = (input: unknown): string[] => {
  const parsed = timelineSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const t = parsed.data;
  const issues: string[] = [];
  const ids = new Set<string>();
  const trackIds = new Set<string>();
  for (const tr of t.tracks) {
    if (trackIds.has(tr.id)) issues.push(`duplicate track id ${tr.id}`);
    trackIds.add(tr.id);
    const sorted = [...tr.clips].sort((a, b) => a.start - b.start);
    sorted.forEach((c, i) => {
      if (ids.has(c.id)) issues.push(`duplicate clip id ${c.id}`);
      ids.add(c.id);
      if (i > 0 && sorted[i - 1] && clipEnd(sorted[i - 1]!) > c.start + EPS && tr.kind !== "overlay")
        issues.push(`track ${tr.id}: clips ${sorted[i - 1]!.id} and ${c.id} overlap`);
      if (c.sourceId) {
        const s = t.sources[c.sourceId];
        if (!s) { issues.push(`clip ${c.id}: unknown source ${c.sourceId}`); return; }
        if (c.in === undefined || c.out === undefined) issues.push(`clip ${c.id}: media clip needs in/out`);
        else {
          if (c.out <= c.in) issues.push(`clip ${c.id}: out must be greater than in`);
          if (c.out > s.duration + EPS) issues.push(`clip ${c.id}: out ${c.out} beyond source duration ${s.duration}`);
          if (Math.abs(c.duration - (c.out - c.in)) > 1e-3) issues.push(`clip ${c.id}: duration must equal out - in`);
        }
      }
      if (tr.kind === "caption") {
        if (!c.words?.length) issues.push(`caption ${c.id}: no words`);
        for (const w of c.words ?? []) {
          if (w.end < w.start) issues.push(`caption ${c.id}: word "${w.w}" ends before it starts`);
          if (w.start < c.start - EPS || w.end > clipEnd(c) + EPS) issues.push(`caption ${c.id}: word "${w.w}" outside clip`);
        }
      }
    });
  }
  if (t.parent !== null && t.parent >= t.version) issues.push("parent must be lower than version");
  if (totalDuration(t) <= 0) issues.push("timeline is empty");
  return issues;
};
