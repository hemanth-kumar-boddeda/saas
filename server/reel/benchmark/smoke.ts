// Live provider smoke test. Usage:
//   ts-node --transpile-only -P tsconfig.json reel/benchmark/smoke.ts <audio|video file> <sarvam|groq> [native|roman] [te|en|hi] [--raw out.json]
// Prints structure and pass/fail only (no transcript text, no keys). --raw writes the provider's raw
// response to a file YOU choose so parsers can be checked against the real shape.
// Exit codes: 0 pass, 1 check failed / vendor error, 3 provider not configured.
import fs from "fs";
import os from "os";
import path from "path";
import { PROVIDERS } from "../asr";
import { ProviderNotConfigured } from "../jobs";
import { extractAudio, probeAudioDuration } from "../../utils/transcode";
import { scriptOf } from "./metrics";

export interface SmokeCheck { name: string; pass: boolean; detail: string }
export const smokeChecks = (r: { words: { w: string; start: number; end: number }[]; text: string }, duration: number, script: "native" | "roman"): SmokeCheck[] => {
  const w = r.words;
  const mono = w.every((x, i) => x.end >= x.start && (i === 0 || x.start >= w[i - 1]!.start - 0.05));
  const inside = w.length > 0 && w[w.length - 1]!.end <= duration + 0.75 && w[0]!.start >= 0;
  const sc = scriptOf(r.text);
  return [
    { name: "returned words with timestamps", pass: w.length > 0, detail: `${w.length} words` },
    { name: "timestamps monotonic", pass: mono, detail: mono ? "ok" : "out of order or end<start" },
    { name: "timestamps inside audio duration", pass: inside, detail: `last end ${w.at(-1)?.end?.toFixed(2)}s vs ${duration.toFixed(2)}s` },
    { name: `script is ${script === "roman" ? "Roman/Latin" : "native (Telugu or mixed)"}`, pass: script === "roman" ? sc === "latin" : sc === "telugu" || sc === "mixed", detail: `detected ${sc}` },
  ];
};

if (require.main === module) {
  (async () => {
    const [file, name, script = "native", lang = "te"] = process.argv.slice(2).filter((a, i, all) => a !== "--raw" && all[i - 1] !== "--raw");
    const rawOut = process.argv.includes("--raw") ? process.argv[process.argv.indexOf("--raw") + 1] : undefined;
    const p = name ? PROVIDERS[name] : undefined;
    if (!file || !p) { console.error("usage: smoke.ts <file> <sarvam|groq> [native|roman] [lang] [--raw out.json]"); process.exit(2); }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-"));
    try {
      const wav = path.join(dir, "a.mp3");
      await extractAudio(file, wav);
      const dur = await probeAudioDuration(wav);
      const raws: unknown[] = [];
      const r = await p.transcribe(wav, { script: script as any, languageHint: lang, onRaw: rawOut ? (x) => raws.push(x) : undefined });
      if (rawOut) fs.writeFileSync(rawOut, JSON.stringify(raws, null, 2), { mode: 0o600 });
      const checks = smokeChecks(r, dur, script as any);
      console.log(JSON.stringify({ provider: r.provider, model: r.model, language: r.language, audioSeconds: dur, speakerLabels: !!r.speakers, checks }, null, 2));
      process.exit(checks.every((c) => c.pass) ? 0 : 1);
    } catch (e: any) {
      if (e instanceof ProviderNotConfigured) { console.error(`NOT CONFIGURED: ${e.message}`); process.exit(3); }
      console.error(`FAILED: ${String(e.message).slice(0, 300)}`); process.exit(1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  })();
}
