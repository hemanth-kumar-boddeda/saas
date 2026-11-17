// Sarvam Saaras adapter (primary Telugu/Tenglish candidate).
// UNVERIFIED against the live API: no key was available when this was written. Request and response
// shapes follow Sarvam's public speech-to-text REST docs from memory; model and mode are env-overridable
// so a mismatch shows up as an explicit vendor error, never a silent wrong result.
// Sarvam's REST endpoint takes short clips, so audio is chunked and word times are offset back.
import fs from "fs";
import os from "os";
import path from "path";
import { ProviderNotConfigured } from "../jobs";
import { Word } from "../schema";
import { splitAudio } from "./audio";
import { AsrProvider, AsrResult } from "./types";

const URL_ = () => process.env.SARVAM_ASR_URL || "https://api.sarvam.ai/speech-to-text";
const CHUNK_S = 25;

/** Pure: maps one Sarvam response to words with offset applied. Throws if timestamps are missing. */
export const parseSarvam = (j: any, offset: number): { text: string; words: Word[]; language?: string } => {
  const ts = j?.timestamps;
  const w: string[] = ts?.words ?? [], s: number[] = ts?.start_time_seconds ?? [], e: number[] = ts?.end_time_seconds ?? [];
  const text = String(j?.transcript ?? "");
  if (text && !w.length) throw new Error("Sarvam returned text without word timestamps; enable timestamps or use another provider");
  if (w.length !== s.length || w.length !== e.length) throw new Error("Sarvam word timestamps are inconsistent");
  return { text, language: j?.language_code, words: w.map((x, i) => ({ w: x, start: offset + s[i]!, end: offset + e[i]! })) };
};

export const sarvam: AsrProvider = {
  name: "sarvam",
  envVar: "SARVAM_API_KEY",
  configured: () => !!process.env.SARVAM_API_KEY,
  async transcribe(audioFile, o = {}): Promise<AsrResult> {
    const key = process.env.SARVAM_API_KEY;
    if (!key) throw new ProviderNotConfigured("Sarvam", "SARVAM_API_KEY");
    const model = process.env.SARVAM_ASR_MODEL || "saaras:v4";
    const script = o.script ?? "native";
    const mode = process.env.SARVAM_ASR_MODE || (script === "roman" ? "translit" : "codemix");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sarvam-"));
    try {
      const words: Word[] = []; let text = ""; let language: string | undefined;
      for (const c of await splitAudio(audioFile, dir, CHUNK_S)) {
        const form = new FormData();
        form.append("file", new Blob([fs.readFileSync(c.file)], { type: "audio/wav" }), "chunk.wav");
        form.append("model", model);
        form.append("mode", mode);
        form.append("language_code", o.languageHint ? `${o.languageHint}-IN` : "unknown");
        form.append("with_timestamps", "true");
        const res = await fetch(URL_(), { method: "POST", headers: { "api-subscription-key": key }, body: form, signal: AbortSignal.timeout(120_000) });
        if (!res.ok) throw new Error(`Sarvam request failed (${res.status}). Check SARVAM_API_KEY, SARVAM_ASR_MODEL=${model}, SARVAM_ASR_MODE=${mode}`);
        const raw = await res.json();
        o.onRaw?.(raw);
        const p = parseSarvam(raw, c.offset);
        words.push(...p.words); text += (text ? " " : "") + p.text; language ??= p.language;
      }
      // speaker labels are not requested here: diarization is reported as unavailable, not guessed
      return { provider: "sarvam", model, language, script: script === "roman" ? "roman" : "native", text, words };
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  },
};
