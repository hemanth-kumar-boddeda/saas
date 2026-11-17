import { z } from "zod";
import { clipEnd, totalDuration } from "../schema";
import { Recommendation, Skill, SkillContext, recommendation } from "./types";

export const checkSchema = z.object({
  name: z.string(), status: z.enum(["pass", "fail", "not_measured"]), measured: z.union([z.number(), z.string(), z.null()]), threshold: z.string(), note: z.string().optional(),
});
export type Check = z.infer<typeof checkSchema>;
const out = z.object({ checks: z.array(checkSchema), passed: z.boolean(), recommendations: z.array(recommendation) });
export type QcOut = z.infer<typeof out>;

const LUFS_TARGET = -16, LUFS_TOL = 2;
const MAX_CPS = 20, MIN_CUE_S = 0.4, MAX_LINE_CHARS = 42;

export const checkQuality = (c: SkillContext): QcOut => {
  const t = c.timeline, r = c.render, checks: Check[] = [], recs: Recommendation[] = [];
  const dur = totalDuration(t);
  const add = (name: string, status: Check["status"], measured: Check["measured"], threshold: string, note?: string) => checks.push({ name, status, measured, threshold, note });

  add("timeline has content", dur > 0 ? "pass" : "fail", +dur.toFixed(2), "> 0 s");
  const target = c.preferences?.targetSeconds;
  if (target) add("length near target", Math.abs(dur - target) / target <= 0.1 ? "pass" : "fail", +dur.toFixed(2), `${target} s ± 10%`);

  if (!r) {
    for (const n of ["rendered resolution", "rendered duration", "integrated loudness"]) add(n, "not_measured", null, "needs a rendered file", "Render a preview first");
  } else {
    add("rendered resolution", r.width === t.output.width && r.height === t.output.height ? "pass" : "fail", `${r.width}x${r.height}`, `${t.output.width}x${t.output.height}`);
    add("rendered duration", Math.abs(r.duration - dur) <= 0.5 ? "pass" : "fail", +r.duration.toFixed(2), `${dur.toFixed(2)} s ± 0.5`);
    if (!r.hasAudio) add("integrated loudness", "not_measured", null, `${LUFS_TARGET} LUFS ± ${LUFS_TOL}`, "Output has no audio");
    else if (r.integratedLufs === undefined) add("integrated loudness", "not_measured", null, `${LUFS_TARGET} LUFS ± ${LUFS_TOL}`, "Loudness could not be measured");
    else {
      const ok = Math.abs(r.integratedLufs - LUFS_TARGET) <= LUFS_TOL;
      add("integrated loudness", ok ? "pass" : "fail", +r.integratedLufs.toFixed(1), `${LUFS_TARGET} LUFS ± ${LUFS_TOL}`);
      const au = t.tracks.find((x) => x.kind === "audio")?.clips[0];
      if (!ok && au) recs.push({ op: "set_clip_audio", args: { clipId: au.id, enhance: "dialogue" }, why: `loudness ${r.integratedLufs.toFixed(1)} LUFS is outside ${LUFS_TARGET} ± ${LUFS_TOL}` });
    }
  }

  const cues = t.tracks.find((x) => x.kind === "caption")?.clips ?? [];
  const words = c.transcript?.words ?? [];
  if (!cues.length) {
    add("captions present", words.length ? "fail" : "not_measured", null, "captions when speech exists", words.length ? undefined : "No transcript");
    if (words.length && c.transcript) recs.push({ op: "add_captions", args: { sourceId: c.transcript.assetId }, why: "speech exists but the timeline has no captions" });
  } else {
    const long = cues.filter((q) => (q.words ?? []).map((w) => (q.captionStyle?.script === "roman" ? w.roman ?? w.w : w.w)).join(" ").length > MAX_LINE_CHARS);
    add("caption line length", long.length ? "fail" : "pass", long.length, `0 cues over ${MAX_LINE_CHARS} chars`);
    const fast = cues.filter((q) => (q.words ?? []).map((w) => w.w).join(" ").length / q.duration > MAX_CPS || q.duration < MIN_CUE_S);
    add("caption reading speed", fast.length ? "fail" : "pass", fast.length, `0 cues over ${MAX_CPS} chars/s or under ${MIN_CUE_S} s`);
    if ((long.length || fast.length) && c.transcript) recs.push({ op: "add_captions", args: { sourceId: c.transcript.assetId, maxWords: 2 }, why: "shorter cues improve readability" });
    // every caption sits on real footage: validate() already enforces word-in-clip; here: gaps vs video end
    const vEnd = Math.max(0, ...t.tracks.filter((x) => x.kind === "video").flatMap((x) => x.clips.map(clipEnd)));
    const spill = cues.filter((q) => clipEnd(q) > vEnd + 0.05).length;
    add("captions end before video ends", spill ? "fail" : "pass", spill, "0 cues past the last frame");
  }
  return { checks, passed: checks.every((x) => x.status !== "fail"), recommendations: recs };
};

export const videoQualityController: Skill<SkillContext, QcOut> = {
  name: "video-quality-controller",
  description: "Check a timeline (and its render) against measurable quality rules. Reports measured values, never guesses.",
  responsibility: "Compare measured facts with thresholds and propose registry operations that fix failures. A check that cannot be measured is reported as not_measured, never as pass.",
  inputSchema: z.object({ timeline: z.any(), render: z.object({ width: z.number(), height: z.number(), duration: z.number(), integratedLufs: z.number().optional() }).optional() }),
  outputSchema: out,
  rules: [
    "Integrated loudness target is -16 LUFS ± 2 for social video.",
    "Rendered resolution and duration must match the timeline.",
    "Caption cues: at most 42 characters, at most 20 characters per second, at least 0.4 s long.",
    "Captions must exist when speech exists.",
    "Unmeasurable means not_measured. It never counts as a pass and never counts as a failure.",
  ],
  decisionCriteria: ["passed = no check has status fail.", "Fixes are proposals; only a human-approved plan changes the timeline."],
  operations: ["set_clip_audio", "add_captions"],
  escalation: [
    "Any render-dependent check not_measured: ask for a preview render before approval.",
    "Loudness still outside range after dialogue enhancement: escalate to a human, the source audio may be unusable.",
  ],
  analyze: checkQuality,
  evalCases: [],
};
