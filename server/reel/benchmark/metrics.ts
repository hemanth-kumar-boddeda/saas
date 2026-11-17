// Pure ASR quality metrics. Each returns a measured number or null when the input cannot support it.
import { Word } from "../schema";

const lev = <T>(a: T[], b: T[]) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
};
export const normalize = (s: string) => s.toLowerCase().normalize("NFC").replace(/[.,!?;:"'()।…-]/g, " ").split(/\s+/).filter(Boolean);
export const wer = (ref: string, hyp: string) => { const r = normalize(ref); return r.length ? lev(r, normalize(hyp)) / r.length : null; };
export const cer = (ref: string, hyp: string) => { const r = [...normalize(ref).join(" ")]; return r.length ? lev(r, [...normalize(hyp).join(" ")]) / r.length : null; };

export type Script = "telugu" | "latin" | "mixed" | "other";
/** Share of letters in Telugu vs Latin script; used to check native vs roman output. */
export const scriptOf = (s: string): Script => {
  const te = (s.match(/[ఀ-౿]/g) ?? []).length, la = (s.match(/[A-Za-z]/g) ?? []).length;
  if (!te && !la) return "other";
  if (te && la) return te / (te + la) > 0.9 ? "telugu" : la / (te + la) > 0.9 ? "latin" : "mixed";
  return te ? "telugu" : "latin";
};

/** Align hyp words to ref words by text (LCS), then compare start times. */
export const timingError = (ref: Word[], hyp: Word[]) => {
  const a = ref.map((w) => normalize(w.w).join(" ")), b = hyp.map((w) => normalize(w.w).join(" "));
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0) as number[]);
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i]![j] = a[i - 1] === b[j - 1] && a[i - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
  const errs: number[] = [];
  for (let i = a.length, j = b.length; i > 0 && j > 0;) {
    if (a[i - 1] && a[i - 1] === b[j - 1]) { errs.push(Math.abs(ref[i - 1]!.start - hyp[j - 1]!.start) * 1000); i--; j--; }
    else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) i--; else j--;
  }
  if (!errs.length) return null;
  const sorted = [...errs].sort((x, y) => x - y);
  return { matched: errs.length, meanMs: errs.reduce((s, x) => s + x, 0) / errs.length, medianMs: sorted[Math.floor(sorted.length / 2)]!, within100: errs.filter((x) => x <= 100).length / errs.length, within200: errs.filter((x) => x <= 200).length / errs.length };
};

/** Recall of reference terms (names, technical vocabulary, English words in Telugu speech) in the hypothesis. */
export const termRecall = (terms: string[], hyp: string) => {
  if (!terms.length) return null;
  const h = new Set(normalize(hyp));
  return terms.filter((t) => normalize(t).every((x) => h.has(x))).length / terms.length;
};
/** English words tagged lang=en in the reference that the hypothesis also contains. */
export const englishRecall = (ref: Word[], hyp: string) => termRecall(ref.filter((w) => w.lang === "en").map((w) => w.w), hyp);

/** Speaker label accuracy over matched words, under the best label mapping (majority vote). null if no labels. */
export const speakerAccuracy = (ref: Word[], hyp: Word[]) => {
  if (!ref.some((w) => w.speaker) || !hyp.some((w) => w.speaker)) return null;
  const votes = new Map<string, Map<string, number>>();
  let n = 0;
  for (const r of ref) {
    const h = hyp.find((x) => normalize(x.w).join() === normalize(r.w).join() && Math.abs(x.start - r.start) < 0.5);
    if (!h?.speaker || !r.speaker) continue;
    n++;
    const m = votes.get(h.speaker) ?? new Map(); m.set(r.speaker, (m.get(r.speaker) ?? 0) + 1); votes.set(h.speaker, m);
  }
  if (!n) return null;
  let ok = 0; for (const m of votes.values()) ok += Math.max(...m.values());
  return ok / n;
};
