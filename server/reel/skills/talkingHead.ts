import { z } from "zod";
import { Timeline, clipEnd, totalDuration } from "../schema";
import { removeRange } from "../ops";
import { Finding, Recommendation, Skill, SkillContext, finding, recommendation } from "./types";

export interface Phrase { id: string; start: number; end: number; text: string; words: number; wordsPerSecond: number; fillerOnly: boolean }
// Conservative: only phrases made ENTIRELY of these tokens are flagged. "అంటే", "so", "like" carry meaning often.
const FILLER = new Set(["um", "umm", "uh", "uhh", "hmm", "mm", "er", "erm", "ah", "ahh"]);
const normTok = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Splits timed words into phrases at pauses >= gap seconds or after sentence punctuation. */
export const buildPhrases = (words: { w: string; start: number; end: number }[], gap = 0.6): Phrase[] => {
  const out: Phrase[] = [];
  let cur: typeof words = [];
  const flush = () => {
    if (!cur.length) return;
    const start = cur[0]!.start, end = cur[cur.length - 1]!.end;
    out.push({ id: `p${out.length + 1}`, start, end, text: cur.map((w) => w.w).join(" "), words: cur.length,
      wordsPerSecond: cur.length / Math.max(0.1, end - start), fillerOnly: cur.every((w) => FILLER.has(normTok(w.w))) });
    cur = [];
  };
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (!next || next.start - w.end >= gap || /[.?!।]$/.test(w.w)) flush();
  });
  return out;
};

export const storyOut = z.object({
  phrases: z.number(), speechSeconds: z.number(), silenceShare: z.number().nullable(),
  fillerPhraseIds: z.array(z.string()), longPauses: z.number(),
  candidates: z.array(z.object({ id: z.string(), start: z.number(), end: z.number(), text: z.string(), wordsPerSecond: z.number() })),
  findings: z.array(finding), recommendations: z.array(recommendation),
});
export type StoryOut = z.infer<typeof storyOut>;

export const analyzeStory = (c: SkillContext): StoryOut => {
  const words = c.transcript?.words ?? [];
  const findings: Finding[] = [], recs: Recommendation[] = [];
  if (!words.length) return { phrases: 0, speechSeconds: 0, silenceShare: null, fillerPhraseIds: [], longPauses: 0, candidates: [], recommendations: [],
    findings: [{ severity: "block", code: "no_transcript", message: "No transcript. Story selection needs timed words." }] };
  const ph = buildPhrases(words);
  const speech = ph.reduce((s, p) => s + (p.end - p.start), 0);
  const asset = c.assets.find((a) => a.id === c.transcript!.assetId);
  const silenceShare = asset ? asset.silences.reduce((s, x) => s + (x.end - x.start), 0) / asset.duration : null;
  const longPauses = asset ? asset.silences.filter((s) => s.end - s.start >= 0.8).length : 0;
  if (asset && longPauses) recs.push({ op: "remove_silences", args: { sourceId: asset.id, minSilence: 0.8, pad: 0.15 }, why: `${longPauses} measured silences of 0.8 s or more` });
  const filler = ph.filter((p) => p.fillerOnly).map((p) => p.id);
  if (filler.length) findings.push({ severity: "info", code: "filler_phrases", message: `${filler.length} phrases are only filler sounds (${filler.join(", ")}); candidates to cut.` });
  const target = c.preferences?.targetSeconds;
  if (target && speech < target * 0.6) findings.push({ severity: "warn", code: "short_source", message: `Only ${speech.toFixed(0)} s of speech for a ${target} s target; selection will keep most of it.` });
  if (!target) findings.push({ severity: "info", code: "no_target", message: "No target length given; defaulting to 30 to 60 s for a vertical reel if the source is longer." });
  return { phrases: ph.length, speechSeconds: speech, silenceShare, fillerPhraseIds: filler, longPauses, findings, recommendations: recs,
    candidates: ph.filter((p) => !p.fillerOnly).map((p) => ({ id: p.id, start: p.start, end: p.end, text: p.text, wordsPerSecond: +p.wordsPerSecond.toFixed(2) })) };
};

/** Model output: which phrases to keep, in source order, plus a hook and reasoning. */
export const selectionSchema = z.object({ hookPhraseId: z.string(), keepPhraseIds: z.array(z.string()).min(1), rationale: z.string().min(10), moveHook: z.boolean().optional() });
export type Selection = z.infer<typeof selectionSchema>;

/**
 * Deterministic: turns a validated selection into remove_range steps. Everything between kept phrases
 * is cut (with `pad` seconds of breathing room), later ranges first so earlier times stay valid.
 * When the hook is not the first kept phrase it is moved to the start with `move_segment`. Nothing extra is
 * deleted by the move and the source is untouched, so the creator can still undo it by rejecting that op.
 */
export const selectionToOps = (t: Timeline, sourceId: string, phrases: Phrase[], sel: Selection, pad = 0.15) => {
  const warnings: string[] = [];
  const byId = new Map(phrases.map((p) => [p.id, p]));
  const keep = sel.keepPhraseIds.map((id) => byId.get(id) ?? (() => { throw new Error(`unknown phrase ${id}`); })());
  if (new Set(sel.keepPhraseIds).size !== keep.length) throw new Error("duplicate phrase ids in selection");
  if (!byId.has(sel.hookPhraseId)) throw new Error(`unknown hook phrase ${sel.hookPhraseId}`);
  if (!sel.keepPhraseIds.includes(sel.hookPhraseId)) throw new Error("hook phrase must be among the kept phrases");
  keep.sort((a, b) => a.start - b.start);
  const lead = t.tracks.find((tr) => tr.clips.some((c) => c.sourceId === sourceId));
  if (!lead) throw new Error(`source ${sourceId} is not on the timeline`);
  // source time -> timeline time via the lead clips
  const toTl = (s: number) => { const c = lead.clips.find((k) => k.sourceId === sourceId && s >= k.in! - 1e-6 && s <= k.out! + 1e-6); return c ? c.start + (s - c.in!) : null; };
  // merge kept spans (padded) in source time
  const spans: [number, number][] = [];
  for (const p of keep) {
    const a = Math.max(0, p.start - pad), b = p.end + pad;
    const last = spans[spans.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b); else spans.push([a, b]);
  }
  const cuts: [number, number][] = [];
  let prev = 0;
  const srcEnd = Math.max(...lead.clips.filter((k) => k.sourceId === sourceId).map((k) => k.out!));
  for (const [a, b] of spans) { if (a > prev) cuts.push([prev, a]); prev = b; }
  if (prev < srcEnd) cuts.push([prev, srcEnd]);
  const steps: { op: string; args: { from: number; to: number } }[] = [];
  for (const [a, b] of cuts) {
    const ta = toTl(a), tb = toTl(Math.min(b, srcEnd));
    if (ta === null || tb === null || tb - ta < 0.05) continue; // already removed earlier
    steps.push({ op: "remove_range", args: { from: +ta.toFixed(3), to: +tb.toFixed(3) } });
  }
  steps.sort((x, y) => y.args.from - x.args.from);
  const kept = totalDuration(t) - steps.reduce((s, x) => s + (x.args.to - x.args.from), 0);
  const all: { op: string; args: Record<string, number> }[] = [...steps];
  if (keep[0]!.id !== sel.hookPhraseId && sel.moveHook !== false) {
    // simulate the cuts to find where the hook sits afterwards, then move that range to 0
    let cur = t;
    for (const s of steps) cur = removeRange(cur, s.args.from, s.args.to);
    const hook = byId.get(sel.hookPhraseId)!;
    const lead2 = cur.tracks.find((tr) => tr.clips.some((c) => c.sourceId === sourceId))!;
    const at = (src: number) => { const c = lead2.clips.find((k) => k.sourceId === sourceId && src >= k.in! - 1e-6 && src <= k.out! + 1e-6); return c ? c.start + (src - c.in!) : null; };
    const a = at(Math.max(0, hook.start - pad)), b = at(hook.end + pad);
    if (a === null || b === null || b <= a) throw new Error("could not locate the hook after cutting");
    if (a > 0.01) {
      all.push({ op: "move_segment", args: { from: +a.toFixed(3), to: +b.toFixed(3), at: 0 } });
      warnings.push(`Hook "${hook.text.slice(0, 40)}" is moved to the start. Check that the story still makes sense after the opening line.`);
    }
  }
  return { steps: all, keptSeconds: kept, warnings };
};

export const talkingHeadStoryEditor: Skill<SkillContext, StoryOut> = {
  name: "talking-head-story-editor",
  description: "Pick the strongest story and hook from one-camera talking-head footage and cut the rest.",
  responsibility: "Measure pauses and filler, offer transcript phrases as candidates, validate the model's phrase selection and convert it into remove_range steps. The model chooses phrases; this skill never invents timestamps.",
  inputSchema: z.object({ transcript: z.object({ words: z.array(z.object({ w: z.string(), start: z.number(), end: z.number() })) }), preferences: z.object({ targetSeconds: z.number().optional() }).optional() }),
  outputSchema: storyOut,
  rules: [
    "Open on the hook: the line that states the payoff or poses the question. If it is not first, it is moved to the start (non-destructive move_segment); cut warm-up greetings unless the creator asks to keep them.",
    "Keep complete phrases. Never cut mid-phrase.",
    "Keep one idea per reel. Prefer a continuous argument over scattered highlights.",
    "Remove filler-only phrases and silences of 0.8 s or more; leave 0.15 s of breath on each side.",
    "Select by phrase id only. Timestamps always come from measured transcript words.",
    "Do not exceed the target length by more than 10%.",
  ],
  decisionCriteria: [
    "Hook candidate: a phrase that works without earlier context (no 'this', 'that one', 'as I said').",
    "Story: kept phrases should answer the hook within the target length.",
    "If the source is shorter than the target, keep everything and only remove silences and filler.",
  ],
  operations: ["remove_range", "remove_silences", "split_clip", "trim_clip"],
  escalation: [
    "No transcript: stop and request transcription.",
    "Selected phrases would leave under 5 s: reject and ask the creator for a longer target or different source.",
    "Hook moved to the start: tell the creator, because the story may no longer make sense after the opening line. Set moveHook=false to keep source order.",
  ],
  analyze: analyzeStory,
  evalCases: [
    { name: "phrases split at pauses and filler detected", input: { timeline: null as any, assets: [{ id: "a", duration: 20, silences: [{ start: 3, end: 4.2 }] }], transcript: { assetId: "a", words: [
        { w: "Hello", start: 0, end: 0.4 }, { w: "friends.", start: 0.5, end: 1 }, { w: "um", start: 2, end: 2.3 }, { w: "Today", start: 5, end: 5.4 }, { w: "we", start: 5.5, end: 5.7 }, { w: "cook", start: 5.8, end: 6.2 }] } },
      expect: (o) => o.phrases === 3 && o.fillerPhraseIds.join() === "p2" && o.longPauses === 1 && o.recommendations[0].op === "remove_silences" },
    { name: "no transcript escalates", input: { timeline: null as any, assets: [] }, expect: (o) => o.findings[0].code === "no_transcript" },
  ],
};
