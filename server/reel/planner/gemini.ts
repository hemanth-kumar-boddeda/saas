// Gemini adapter for the planner. Provider-independent port + one adapter; no key means an explicit
// ProviderNotConfigured, never a canned plan. The API key goes only in a header, never in logs.
import { geminiBody, geminiText, modelFor, vendorError } from "../../services/aiProviders";
import { ProviderNotConfigured } from "../jobs";

export interface PlannerModel {
  name: string; model: string; envVar: string;
  configured(): boolean;
  /** Returns the raw text of the model's reply (expected to be JSON). */
  generate(system: string, user: string, history?: { role: "user" | "assistant"; text: string }[]): Promise<string>;
}

export const gemini: PlannerModel = {
  name: "gemini",
  get model() { return process.env.GEMINI_PLANNER_MODEL || modelFor("gemini", "smart", process.env); },
  envVar: "GEMINI_API_KEY",
  configured: () => !!process.env.GEMINI_API_KEY,
  async generate(system, user, history = []) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ProviderNotConfigured("Gemini", "GEMINI_API_KEY");
    const body = geminiBody({ tier: "smart", system, turns: [{ role: "user", text: user }, ...history], maxTokens: 8192 });
    (body.generationConfig as any).temperature = 0.3;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(vendorError("Gemini", res.status).message);
    const text = geminiText(await res.json());
    if (!text) throw new Error("Gemini returned an empty reply");
    return text;
  },
};
export const plannerModel = (): PlannerModel => gemini;
