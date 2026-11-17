import { Word } from "../schema";

export interface AsrOptions { languageHint?: string; script?: "native" | "roman"; diarize?: boolean; onRaw?: (raw: unknown) => void }
export interface AsrResult {
  provider: string; model: string; language?: string; script: "native" | "roman" | "latin";
  text: string;
  words: Word[]; // times in SOURCE seconds
  speakers?: boolean; // true only when the provider actually returned speaker labels
}
export interface AsrProvider {
  name: string;
  envVar: string;
  configured(): boolean;
  /** Throws ProviderNotConfigured when the key is missing. Never returns invented output. */
  transcribe(audioFile: string, o?: AsrOptions): Promise<AsrResult>;
}
