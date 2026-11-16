// Pure AI-provider rules: which provider to use, model names, request/response shapes.
// No network here so everything is unit-tested (tests/aiProviders.test.ts).
export type Provider = "anthropic" | "gemini" | "groq";
export type Tier = "smart" | "fast";
export type Env = Record<string, string | undefined>;

export interface Turn { role: "user" | "assistant"; text: string }
export interface CompleteReq { tier: Tier; system: string; turns: Turn[]; images?: Buffer[]; audio?: Buffer; maxTokens: number }

/**
 * AI_PROVIDER wins when set and configured. Otherwise the first configured of
 * Anthropic, Gemini (free tier), Groq (free tier).
 */
export const pickProvider = (env: Env): Provider | null => {
  const has: Record<Provider, boolean> = { anthropic: !!env.ANTHROPIC_API_KEY, gemini: !!env.GEMINI_API_KEY, groq: !!env.GROQ_API_KEY };
  const want = (env.AI_PROVIDER || "").toLowerCase() as Provider;
  if (want in has && has[want]) return want;
  return (["anthropic", "gemini", "groq"] as Provider[]).find((p) => has[p]) ?? null;
};

/** Speech-to-text: Groq Whisper (free, accurate timing), OpenAI Whisper, then Gemini audio. */
export const pickTranscriber = (env: Env): "groq" | "openai" | "gemini" | null =>
  env.GROQ_API_KEY ? "groq" : env.OPENAI_API_KEY ? "openai" : env.GEMINI_API_KEY ? "gemini" : null;

/** Only these providers can look at images. Others rank frames with local sharpness/contrast. */
export const hasVision = (p: Provider | null) => p === "anthropic" || p === "gemini";

const DEFAULT_MODELS: Record<Provider, Record<Tier, string>> = {
  anthropic: { smart: "claude-sonnet-5-5", fast: "claude-haiku-5-5" },
  gemini: { smart: "gemini-2.5-flash", fast: "gemini-2.5-flash-lite" },
  groq: { smart: "llama-3.3-70b-versatile", fast: "llama-3.1-8b-instant" },
};
/** Model names change often: override per provider with e.g. GEMINI_MODEL_SMART. */
export const modelFor = (p: Provider, tier: Tier, env: Env = {}) =>
  env[`${p.toUpperCase()}_MODEL_${tier.toUpperCase()}`] || DEFAULT_MODELS[p][tier];

const b64 = (b: Buffer) => b.toString("base64");

export const geminiBody = (r: CompleteReq) => ({
  systemInstruction: { parts: [{ text: r.system }] },
  contents: r.turns.map((t, i) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [
      ...(i === 0 && r.audio ? [{ inline_data: { mime_type: "audio/mpeg", data: b64(r.audio) } }] : []),
      ...(i === 0 ? (r.images ?? []).flatMap((img, n) => [{ text: `Frame ${n}:` }, { inline_data: { mime_type: "image/jpeg", data: b64(img) } }]) : []),
      { text: t.text },
    ],
  })),
  generationConfig: { maxOutputTokens: r.maxTokens, responseMimeType: "application/json", temperature: 0.7 },
});
export const geminiText = (j: any): string =>
  (j?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");

/** OpenAI-compatible chat body (Groq). Text only: Groq's free models take no images here. */
export const chatBody = (r: CompleteReq, model: string) => ({
  model, max_tokens: r.maxTokens, temperature: 0.7, response_format: { type: "json_object" },
  messages: [{ role: "system", content: r.system }, ...r.turns.map((t) => ({ role: t.role, content: t.text }))],
});
export const chatText = (j: any): string => j?.choices?.[0]?.message?.content ?? "";

/** User-facing message for a failed vendor call. Never includes keys or raw bodies. */
export const vendorError = (vendor: string, status: number): { status: number; message: string } =>
  status === 429 ? { status: 503, message: `${vendor} is rate-limiting free requests. Wait a minute and try again.` }
  : status === 401 || status === 403 ? { status: 503, message: `${vendor} rejected the API key. Check it in server/.env.` }
  : { status: 502, message: `${vendor} request failed (${status}).` };

/** Cheap frame score 0-100 from image statistics: sharp, well-exposed, contrasty frames win. */
export const frameScore = (s: { sharpness: number; brightness: number; contrast: number }) => {
  const sharp = Math.min(1, s.sharpness / 40);                  // laplacian stdev, ~40 is crisp at 640px
  const expo = 1 - Math.min(1, Math.abs(s.brightness - 118) / 118); // best near mid-grey
  const con = Math.min(1, s.contrast / 70);
  return Math.round(100 * (0.5 * sharp + 0.25 * expo + 0.25 * con));
};
