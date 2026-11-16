import { describe, it, expect } from "vitest";
import {
  pickProvider, pickTranscriber, hasVision, modelFor, geminiBody, geminiText, chatBody, chatText, vendorError, frameScore,
} from "../services/aiProviders";

describe("pickProvider", () => {
  it("returns null with no keys", () => expect(pickProvider({})).toBeNull());
  it("prefers anthropic, then gemini, then groq", () => {
    expect(pickProvider({ ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g", GROQ_API_KEY: "q" })).toBe("anthropic");
    expect(pickProvider({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q" })).toBe("gemini");
    expect(pickProvider({ GROQ_API_KEY: "q" })).toBe("groq");
  });
  it("AI_PROVIDER wins only when its key exists", () => {
    expect(pickProvider({ AI_PROVIDER: "groq", GEMINI_API_KEY: "g", GROQ_API_KEY: "q" })).toBe("groq");
    expect(pickProvider({ AI_PROVIDER: "groq", GEMINI_API_KEY: "g" })).toBe("gemini");
    expect(pickProvider({ AI_PROVIDER: "GEMINI", GEMINI_API_KEY: "g" })).toBe("gemini");
  });
});

describe("pickTranscriber / vision / models", () => {
  it("prefers Groq whisper, then OpenAI, then Gemini audio", () => {
    expect(pickTranscriber({ GROQ_API_KEY: "q", OPENAI_API_KEY: "o", GEMINI_API_KEY: "g" })).toBe("groq");
    expect(pickTranscriber({ OPENAI_API_KEY: "o", GEMINI_API_KEY: "g" })).toBe("openai");
    expect(pickTranscriber({ GEMINI_API_KEY: "g" })).toBe("gemini");
    expect(pickTranscriber({})).toBeNull();
  });
  it("only anthropic and gemini see images", () => {
    expect([hasVision("anthropic"), hasVision("gemini"), hasVision("groq"), hasVision(null)]).toEqual([true, true, false, false]);
  });
  it("model names have defaults and can be overridden", () => {
    expect(modelFor("gemini", "smart")).toMatch(/gemini/);
    expect(modelFor("anthropic", "fast")).toBe("claude-haiku-5-5");
    expect(modelFor("gemini", "smart", { GEMINI_MODEL_SMART: "gemini-x" })).toBe("gemini-x");
  });
});

describe("request/response shapes", () => {
  const req = { tier: "smart" as const, system: "S", maxTokens: 100, images: [Buffer.from("img")], audio: Buffer.from("aud"), turns: [{ role: "user" as const, text: "U" }, { role: "assistant" as const, text: "A" }, { role: "user" as const, text: "U2" }] };
  it("gemini: system, roles, media only on the first turn, JSON mode", () => {
    const b: any = geminiBody(req);
    expect(b.systemInstruction.parts[0].text).toBe("S");
    expect(b.contents.map((c: any) => c.role)).toEqual(["user", "model", "user"]);
    expect(b.contents[0].parts.some((p: any) => p.inline_data?.mime_type === "audio/mpeg")).toBe(true);
    expect(b.contents[0].parts.some((p: any) => p.inline_data?.mime_type === "image/jpeg")).toBe(true);
    expect(b.contents[1].parts).toEqual([{ text: "A" }]);
    expect(b.generationConfig).toMatchObject({ responseMimeType: "application/json", maxOutputTokens: 100 });
  });
  it("gemini text extraction tolerates empty answers", () => {
    expect(geminiText({ candidates: [{ content: { parts: [{ text: "{" }, { text: "}" }] } }] })).toBe("{}");
    expect(geminiText({})).toBe("");
  });
  it("groq chat body and text", () => {
    const b: any = chatBody(req, "m");
    expect(b.messages[0]).toEqual({ role: "system", content: "S" });
    expect(b.response_format).toEqual({ type: "json_object" });
    expect(chatText({ choices: [{ message: { content: "{}" } }] })).toBe("{}");
    expect(chatText(null)).toBe("");
  });
  it("vendor errors are friendly and never leak details", () => {
    expect(vendorError("Gemini", 429)).toMatchObject({ status: 503 });
    expect(vendorError("Gemini", 401).message).toMatch(/API key/);
    expect(vendorError("Groq", 500).message).toBe("Groq request failed (500).");
  });
});

describe("frameScore", () => {
  it("rewards sharp, well exposed, contrasty frames and stays within 0-100", () => {
    const good = frameScore({ sharpness: 50, brightness: 120, contrast: 80 });
    const bad = frameScore({ sharpness: 2, brightness: 250, contrast: 5 });
    expect(good).toBeGreaterThan(bad);
    expect(good).toBeLessThanOrEqual(100);
    expect(bad).toBeGreaterThanOrEqual(0);
  });
});
