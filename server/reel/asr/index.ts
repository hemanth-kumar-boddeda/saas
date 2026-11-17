import { AsrProvider } from "./types";
import { sarvam } from "./sarvam";
import { groq } from "./groq";

export const PROVIDERS: Record<string, AsrProvider> = { sarvam, groq };
/** Order of preference when the caller does not choose: Sarvam, then Groq. */
export const pickAsr = (name?: string): AsrProvider => {
  if (name) { const p = PROVIDERS[name]; if (!p) throw new Error(`unknown ASR provider ${name}`); return p; }
  return Object.values(PROVIDERS).find((p) => p.configured()) ?? sarvam; // unconfigured Sarvam -> explicit not-configured error
};
export const asrStatus = () => Object.values(PROVIDERS).map((p) => ({ name: p.name, configured: p.configured(), envVar: p.envVar }));
