// Benchmark runner. Usage: ts-node --transpile-only reel/benchmark/run.ts <manifest.json> [provider,...] [out.json]
// A manifest item without explicit consent is REJECTED, not skipped silently.
import fs from "fs";
import path from "path";
import { z } from "zod";
import { PROVIDERS } from "../asr";
import { AsrProvider } from "../asr/types";
import { ProviderNotConfigured } from "../jobs";
import { cer, englishRecall, scriptOf, speakerAccuracy, termRecall, timingError, wer } from "./metrics";

const refWord = z.object({ w: z.string(), start: z.number(), end: z.number(), lang: z.string().optional(), speaker: z.string().optional() });
export const manifestSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    audio: z.string(), // path relative to the manifest
    consent: z.object({ given: z.literal(true), by: z.string().min(1), date: z.string().min(1) }),
    category: z.enum(["telugu_native", "roman_telugu", "code_switch", "english_in_telugu", "names_technical", "multi_speaker"]),
    languageHint: z.string().optional(),
    script: z.enum(["native", "roman"]).default("native"),
    reference: z.object({ text: z.string().min(1), words: z.array(refWord).optional() }),
    terms: z.array(z.string()).default([]),
  })).min(1),
});
export type Manifest = z.infer<typeof manifestSchema>;

export const loadManifest = (file: string): Manifest => {
  const r = manifestSchema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!r.success) throw new Error(`manifest rejected (every item needs consent.given === true): ${r.error.issues[0]?.path.join(".")}: ${r.error.issues[0]?.message}`);
  return r.data;
};

export const runBenchmark = async (m: Manifest, baseDir: string, providers: AsrProvider[]) => {
  const report: any[] = [];
  for (const p of providers) {
    if (!p.configured()) { report.push({ provider: p.name, status: "not_configured", envVar: p.envVar }); continue; }
    const items: any[] = [];
    for (const it of m.items) {
      const t0 = Date.now();
      try {
        const out = await p.transcribe(path.resolve(baseDir, it.audio), { languageHint: it.languageHint, script: it.script });
        const rw = it.reference.words;
        items.push({
          id: it.id, category: it.category, seconds: (Date.now() - t0) / 1000,
          wer: wer(it.reference.text, out.text), cer: cer(it.reference.text, out.text),
          scriptOk: it.script === "roman" ? scriptOf(out.text) === "latin" : scriptOf(out.text) !== "other",
          termRecall: termRecall(it.terms, out.text),
          englishRecall: rw ? englishRecall(rw, out.text) : null,
          timing: rw ? timingError(rw as any, out.words) : null,
          speakerAccuracy: rw ? speakerAccuracy(rw as any, out.words) : null,
        });
      } catch (e: any) {
        items.push({ id: it.id, category: it.category, error: e instanceof ProviderNotConfigured ? "not_configured" : e.message });
      }
    }
    report.push({ provider: p.name, status: "ran", items });
  }
  return report;
};

if (require.main === module) {
  const [manifest, names, out] = process.argv.slice(2);
  if (!manifest) { console.error("usage: run.ts <manifest.json> [sarvam,groq] [out.json]"); process.exit(2); }
  const ps = (names ? names.split(",") : Object.keys(PROVIDERS)).map((n) => PROVIDERS[n] ?? (() => { throw new Error(`unknown provider ${n}`); })());
  runBenchmark(loadManifest(manifest), path.dirname(path.resolve(manifest)), ps).then((r) => {
    const s = JSON.stringify(r, null, 2); if (out) fs.writeFileSync(out, s); else console.log(s);
  });
}
