// Groq Whisper fallback (OpenAI-compatible endpoint). Word timestamps via verbose_json.
// Whisper has no diarization and often romanises or translates Telugu poorly: benchmark before trusting it.
import fs from "fs";
import { ProviderNotConfigured } from "../jobs";
import { Word } from "../schema";
import { AsrProvider, AsrResult } from "./types";

export const parseWhisper = (j: any): { text: string; words: Word[]; language?: string } => {
  const words: Word[] = (j?.words ?? []).map((w: any) => ({ w: String(w.word).trim(), start: Number(w.start), end: Number(w.end) }));
  if (j?.text && !words.length) throw new Error("Groq returned text without word timestamps");
  return { text: String(j?.text ?? ""), words, language: j?.language };
};

export const groq: AsrProvider = {
  name: "groq",
  envVar: "GROQ_API_KEY",
  configured: () => !!process.env.GROQ_API_KEY,
  async transcribe(audioFile, o = {}): Promise<AsrResult> {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new ProviderNotConfigured("Groq", "GROQ_API_KEY");
    const model = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3";
    const buf = fs.readFileSync(audioFile);
    if (buf.length > 25 * 1024 * 1024) throw new Error("audio exceeds Groq's 25 MB limit; transcode to mono 16 kHz mp3 first");
    const form = new FormData();
    form.append("file", new Blob([buf], { type: "audio/mpeg" }), "audio.mp3");
    form.append("model", model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    if (o.languageHint) form.append("language", o.languageHint);
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(300_000) });
    if (!res.ok) throw new Error(`Groq request failed (${res.status}). Check GROQ_API_KEY`);
    const p = parseWhisper(await res.json());
    return { provider: "groq", model, language: p.language, script: "native", text: p.text, words: p.words };
  },
};
