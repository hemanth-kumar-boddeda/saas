// The only file that talks to AI vendors: Anthropic, Google Gemini (free tier), Groq (free tier), OpenAI Whisper.
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import sharp from "sharp";
import { z } from "zod";
import ErrorHandler from "./ErrorHandler";
import { parseModelJson, Segment } from "../services/publishKitLogic";
import {
  CompleteReq, Provider, Tier, chatBody, chatText, frameScore, geminiBody, geminiText, hasVision, modelFor, pickProvider, pickTranscriber, vendorError,
} from "../services/aiProviders";

export type Complete = (r: CompleteReq) => Promise<string>;
export const MODELS = { smart: "smart", fast: "fast" } as const; // tiers, resolved per provider

export const aiProvider = () => pickProvider(process.env);
/** True when frames can be judged by a vision model (else local scoring is used). */
export const visionAvailable = () => hasVision(aiProvider());

const post = async (vendor: string, url: string, headers: Record<string, string>, body: unknown) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
  if (!res.ok) { const e = vendorError(vendor, res.status); throw new ErrorHandler(e.status, e.message); }
  return res.json();
};

let anthropic: Anthropic | null = null;
const defaultComplete = (): Complete => completeWith(aiProvider());
const completeWith = (p: Provider | null): Complete => {
  if (!p) throw new ErrorHandler(503, "AI is not configured. Set GEMINI_API_KEY (free), GROQ_API_KEY (free) or ANTHROPIC_API_KEY in server/.env");
  const model = (t: Tier) => modelFor(p, t, process.env);
  if (p === "gemini")
    return async (r) => geminiText(await post("Gemini", `https://generativelanguage.googleapis.com/v1beta/models/${model(r.tier)}:generateContent`, { "x-goog-api-key": process.env.GEMINI_API_KEY! }, geminiBody(r)));
  if (p === "groq")
    return async (r) => chatText(await post("Groq", "https://api.groq.com/openai/v1/chat/completions", { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, chatBody(r, model(r.tier))));
  anthropic ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return async (r) => {
    const first: any[] = (r.images ?? []).flatMap((b, i) => [
      { type: "text", text: `Frame ${i}:` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b.toString("base64") } },
    ]);
    const res: any = await anthropic!.messages.create({
      model: model(r.tier), max_tokens: r.maxTokens, system: r.system,
      messages: r.turns.map((t, i) => ({ role: t.role, content: i === 0 && first.length ? [...first, { type: "text", text: t.text }] : t.text })) as any,
    });
    return (res.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("");
  };
};

export interface AskOptions { tier: Tier; system: string; user: string; images?: Buffer[]; audio?: Buffer; maxTokens?: number; attempts?: number }

/**
 * Asks for a JSON object, validates it with zod and, when invalid, shows the model its own
 * answer plus the validation error and asks again (up to `attempts`).
 */
export const askJson = async <T extends z.ZodTypeAny>(schema: T, o: AskOptions, complete: Complete = defaultComplete()): Promise<z.infer<T>> => {
  const turns: CompleteReq["turns"] = [{ role: "user", text: o.user }];
  const attempts = o.attempts ?? 3;
  let lastError = "";
  for (let n = 1; n <= attempts; n++) {
    const text = await complete({ tier: o.tier, system: `${o.system}\nReply with one JSON object only. No prose, no markdown.`, turns, images: o.images, audio: o.audio, maxTokens: o.maxTokens ?? 4096 });
    const r = parseModelJson(text, schema);
    if (r.ok) return r.data;
    lastError = r.error;
    turns.push({ role: "assistant", text: text || "(empty)" }, { role: "user", text: `Your reply was invalid: ${r.error}. Reply again with a corrected JSON object only.` });
  }
  throw new ErrorHandler(502, `AI returned invalid output after ${attempts} attempts: ${lastError}`);
};

/** Local frame ranking for providers without vision: sharpness (Laplacian), exposure and contrast. */
export const rankFramesLocal = async (files: string[]) =>
  Promise.all(files.map(async (f, index) => {
    const img = sharp(f).greyscale();
    const st = await img.clone().stats();
    const lap = await img.clone().convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] }).stats();
    const score = frameScore({ sharpness: lap.channels[0].stdev, brightness: st.channels[0].mean, contrast: st.channels[0].stdev });
    return { index, score, reason: "Local score: sharpness, exposure and contrast" };
  }));

const WHISPER_MAX = 25 * 1024 * 1024;
const segmentsOut = z.object({ segments: z.array(z.object({ start: z.number().min(0), end: z.number().min(0), text: z.string() })).min(1) });

/** Timed transcript. Groq/OpenAI Whisper when available, else Gemini listening to the audio. */
export const transcribe = async (audioFile: string): Promise<{ text: string; segments: Segment[] }> => {
  const who = pickTranscriber(process.env);
  if (!who) throw new ErrorHandler(503, "Transcription is not configured. Set GROQ_API_KEY (free), GEMINI_API_KEY (free) or OPENAI_API_KEY in server/.env");
  const buf = await fs.promises.readFile(audioFile);
  if (who === "gemini") {
    if (buf.length > 18 * 1024 * 1024) throw new ErrorHandler(413, "Audio is too long for Gemini transcription (about 75 minutes max). Add a Groq key for longer videos.");
    const out = await askJson(segmentsOut, {
      tier: "smart", maxTokens: 8192,
      system: "You transcribe audio faithfully with timestamps in seconds. Do not summarise or translate.",
      user: 'Transcribe the attached audio. Return {"segments":[{"start":seconds,"end":seconds,"text":string}]} with segments of one or two sentences.',
      audio: buf,
    }, completeWith("gemini"));
    return { text: out.segments.map((s) => s.text).join(" "), segments: out.segments };
  }
  if (buf.length > WHISPER_MAX) throw new ErrorHandler(413, "Audio is longer than the 25 MB transcription limit");
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", who === "groq" ? process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo" : process.env.WHISPER_MODEL || "whisper-1");
  form.append("response_format", "verbose_json");
  const url = who === "groq" ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions";
  const key = who === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(300_000) });
  if (!res.ok) { const e = vendorError(who === "groq" ? "Groq" : "OpenAI", res.status); throw new ErrorHandler(e.status, e.message); }
  const j: any = await res.json();
  return {
    text: String(j.text ?? ""),
    segments: (j.segments ?? []).map((s: any) => ({ start: Number(s.start), end: Number(s.end), text: String(s.text) })),
  };
};
