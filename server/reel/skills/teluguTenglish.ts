import { z } from "zod";
import { scriptOf } from "../benchmark/metrics";
import { Finding, Recommendation, Skill, SkillContext, finding, recommendation } from "./types";

const TE = /[ఀ-౿]/;
const LA = /[A-Za-z]/;
export type WordLang = "te" | "en" | "other";
export const wordLang = (w: string): WordLang => (TE.test(w) ? "te" : LA.test(w) ? "en" : "other");

const out = z.object({
  teluguShare: z.number(), latinShare: z.number(), codeSwitches: z.number(), wordCount: z.number(),
  dominant: z.enum(["telugu", "tenglish", "english", "unknown"]),
  recommendedScript: z.enum(["native", "roman"]),
  timingIssues: z.number(),
  findings: z.array(finding), recommendations: z.array(recommendation),
});
export type TeluguOut = z.infer<typeof out>;

export const analyzeTelugu = (c: SkillContext): TeluguOut => {
  const words = c.transcript?.words ?? [];
  const findings: Finding[] = [], recs: Recommendation[] = [];
  if (!words.length) return { teluguShare: 0, latinShare: 0, codeSwitches: 0, wordCount: 0, dominant: "unknown", recommendedScript: "native", timingIssues: 0,
    findings: [{ severity: "block", code: "no_transcript", message: "No transcript. Run transcribe (Sarvam) first; this skill cannot guess speech." }], recommendations: [] };
  const langs = words.map((w) => wordLang(w.lang === "en" ? "x" : w.w)).map((l, i) => (words[i]!.lang === "en" ? "en" : l));
  const te = langs.filter((l) => l === "te").length, en = langs.filter((l) => l === "en").length;
  const total = Math.max(1, te + en);
  let switches = 0;
  for (let i = 1; i < langs.length; i++) if (langs[i] !== langs[i - 1] && langs[i] !== "other" && langs[i - 1] !== "other") switches++;
  const teluguShare = te / total, latinShare = en / total;
  const romanOnly = te === 0 && words.every((w) => !!w.roman || LA.test(w.w));
  // In Roman transcripts Telugu and English are both Latin, so share cannot tell them apart.
  const dominant = romanOnly ? "unknown" : teluguShare > 0.85 ? "telugu" : latinShare > 0.85 ? "english" : "tenglish";
  if (romanOnly) findings.push({ severity: "info", code: "roman_transcript", message: "Transcript is Roman script, so Telugu vs English words cannot be separated by script. Use provider language tags if available." });
  // timing sanity on provider word times
  let timing = 0;
  words.forEach((w, i) => {
    if (w.end <= w.start || w.end - w.start > 3 || (i > 0 && w.start < words[i - 1]!.start - 0.01)) timing++;
  });
  if (timing / words.length > 0.05) findings.push({ severity: "warn", code: "timing_unreliable", message: `${timing} of ${words.length} words have suspect timestamps (zero length, over 3 s, or out of order). Caption sync may drift; review captions before approval.` });
  const pref = c.preferences?.captionScript;
  let script: "native" | "roman" = pref ?? "native";
  if (pref === "roman" && !words.every((w) => w.roman || LA.test(w.w))) {
    findings.push({ severity: "block", code: "roman_missing", message: "Creator wants Roman captions but the transcript has no Roman text. Re-transcribe with script=roman. Do not auto-transliterate by guessing." });
    script = "native";
  }
  const avgCodepoints = words.reduce((s, w) => s + [...w.w].length, 0) / words.length;
  const maxWords = avgCodepoints > 7 ? 3 : 4; // Telugu words are long; keep cues readable on a 9:16 frame
  if (c.transcript) recs.push({ op: "add_captions", args: { sourceId: c.transcript.assetId, script, maxWords }, why: `${dominant} speech; ${script} script; ${maxWords} words per cue (avg ${avgCodepoints.toFixed(1)} chars/word)` });
  if (dominant === "tenglish" && switches > 0) findings.push({ severity: "info", code: "code_switching", message: `${switches} language switches. Keep English words in Latin script inside native captions; do not translate them.` });
  return { teluguShare, latinShare, codeSwitches: switches, wordCount: words.length, dominant, recommendedScript: script, timingIssues: timing, findings, recommendations: recs };
};

export const teluguTenglishEditor: Skill<SkillContext, TeluguOut> = {
  name: "telugu-tenglish-editor",
  description: "Caption and transcript decisions for Telugu, Roman Telugu and Telugu-English (Tenglish) speech.",
  responsibility: "Decide caption script, cue size and flag transcript or timing problems specific to Telugu and code-switched speech. Does not transcribe and does not translate.",
  inputSchema: z.object({ transcript: z.object({ words: z.array(z.object({ w: z.string(), start: z.number(), end: z.number() })) }), preferences: z.object({ captionScript: z.enum(["native", "roman"]).optional() }).optional() }),
  outputSchema: out,
  rules: [
    "Never translate. Captions show what was said.",
    "Keep English words in Latin script inside native-script captions.",
    "Use at most 3 words per cue when average word length exceeds 7 characters, else 4.",
    "Roman captions only when the transcript really contains Roman text. Never invent transliteration.",
    "Never change word timestamps. Only the provider's measured times are used.",
  ],
  decisionCriteria: [
    "dominant = telugu when Telugu-script words exceed 85%, english above 85% Latin, else tenglish.",
    "More than 5% suspect word timestamps raises a warning before captions are trusted.",
  ],
  operations: ["add_captions", "edit_caption_word"],
  escalation: [
    "No transcript: stop and request transcription.",
    "Roman captions requested without Roman text: stop and request re-transcription with script=roman.",
    "Provider not configured: report the missing key; do not substitute another language's output.",
  ],
  analyze: analyzeTelugu,
  evalCases: [
    { name: "pure Telugu defaults to native, 3 words per cue", input: { timeline: null as any, assets: [], transcript: { assetId: "a", words: [{ w: "నమస్కారం", start: 0, end: 1 }, { w: "అందరికీ", start: 1, end: 2 }, { w: "స్వాగతం", start: 2, end: 3 }] } },
      expect: (o) => o.dominant === "telugu" && o.recommendedScript === "native" && o.recommendations[0].args.maxWords === 3 },
    { name: "Tenglish counts code switches and keeps native", input: { timeline: null as any, assets: [], transcript: { assetId: "a", words: [{ w: "ఈ", start: 0, end: 0.2 }, { w: "meeting", start: 0.2, end: 0.6 }, { w: "చాలా", start: 0.6, end: 0.9 }, { w: "important", start: 0.9, end: 1.4 }] } },
      expect: (o) => o.dominant === "tenglish" && o.codeSwitches === 3 },
    { name: "roman preference without roman text blocks", input: { timeline: null as any, assets: [], preferences: { captionScript: "roman" }, transcript: { assetId: "a", words: [{ w: "నమస్కారం", start: 0, end: 1 }] } },
      expect: (o) => o.findings.some((f: Finding) => f.code === "roman_missing" && f.severity === "block") && o.recommendedScript === "native" },
    { name: "no transcript escalates", input: { timeline: null as any, assets: [] }, expect: (o) => o.findings[0].code === "no_transcript" && o.recommendations.length === 0 },
    { name: "bad timestamps warn", input: { timeline: null as any, assets: [], transcript: { assetId: "a", words: [{ w: "a", start: 0, end: 0 }, { w: "b", start: 1, end: 9 }] } }, expect: (o) => o.findings.some((f: Finding) => f.code === "timing_unreliable") },
  ],
};
export { scriptOf };
