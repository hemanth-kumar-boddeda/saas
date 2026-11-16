// Anthropic + Whisper calls. The only file that talks to AI vendors.
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import { z } from "zod";
import ErrorHandler from "./ErrorHandler";
import { parseModelJson, Segment } from "../services/publishKitLogic";

export const MODELS = { smart: "claude-sonnet-5-5", fast: "claude-haiku-5-5" } as const;

export interface AskOptions {
  model: string;
  system: string;
  user: string;
  images?: Buffer[]; // jpeg
  maxTokens?: number;
  attempts?: number;
}
type Client = Pick<Anthropic, "messages">;

let shared: Anthropic | null = null;
const client = (): Client => {
  if (!process.env.ANTHROPIC_API_KEY) throw new ErrorHandler(503, "AI is not configured (ANTHROPIC_API_KEY missing)");
  return (shared ??= new Anthropic({ maxRetries: 2, timeout: 120_000 }));
};

/**
 * Asks for a JSON object, validates it with zod and, when invalid, shows the model
 * its own answer plus the validation error and asks again (up to `attempts`).
 * The SDK separately retries 429/5xx.
 */
export const askJson = async <T extends z.ZodTypeAny>(
  schema: T,
  o: AskOptions,
  c: Client = client()
): Promise<z.infer<T>> => {
  const content: any[] = (o.images ?? []).flatMap((b, i) => [
    { type: "text", text: `Frame ${i}:` },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b.toString("base64") } },
  ]);
  content.push({ type: "text", text: o.user });
  const messages: any[] = [{ role: "user", content }];
  const attempts = o.attempts ?? 3;
  let lastError = "";
  for (let n = 1; n <= attempts; n++) {
    const res: any = await c.messages.create({
      model: o.model,
      max_tokens: o.maxTokens ?? 4096,
      system: `${o.system}\nReply with one JSON object only. No prose, no markdown.`,
      messages,
    });
    const text = (res.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("");
    const r = parseModelJson(text, schema);
    if (r.ok) return r.data;
    lastError = r.error;
    messages.push(
      { role: "assistant", content: text || "(empty)" },
      { role: "user", content: `Your reply was invalid: ${r.error}. Reply again with a corrected JSON object only.` }
    );
  }
  throw new ErrorHandler(502, `AI returned invalid output after ${attempts} attempts: ${lastError}`);
};

const WHISPER_MAX = 25 * 1024 * 1024;

/** OpenAI Whisper API (Claude takes no audio). Returns timed segments. */
export const transcribe = async (audioFile: string): Promise<{ text: string; segments: Segment[] }> => {
  if (!process.env.OPENAI_API_KEY) throw new ErrorHandler(503, "Transcription is not configured (OPENAI_API_KEY missing)");
  const buf = await fs.promises.readFile(audioFile);
  if (buf.length > WHISPER_MAX) throw new ErrorHandler(413, "Audio is longer than the 25 MB transcription limit");
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", process.env.WHISPER_MODEL || "whisper-1");
  form.append("response_format", "verbose_json");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new ErrorHandler(502, `Transcription failed (${res.status})`);
  const j: any = await res.json();
  return {
    text: String(j.text ?? ""),
    segments: (j.segments ?? []).map((s: any) => ({ start: Number(s.start), end: Number(s.end), text: String(s.text) })),
  };
};
