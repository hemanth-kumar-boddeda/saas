import fs from "fs";
import path from "path";
import { run, probeAudioDuration } from "../../utils/transcode";

/** Splits audio into mono 16 kHz wav chunks of at most `seconds`. Returns file + offset. */
export const splitAudio = async (src: string, outDir: string, seconds: number) => {
  fs.mkdirSync(outDir, { recursive: true });
  const total = await probeAudioDuration(src);
  const out: { file: string; offset: number }[] = [];
  for (let off = 0, i = 0; off < total - 0.05; off += seconds, i++) {
    const file = path.join(outDir, `chunk_${String(i).padStart(4, "0")}.wav`);
    await run("ffmpeg", ["-y", "-hide_banner", "-ss", String(off), "-t", String(seconds), "-i", src, "-ac", "1", "-ar", "16000", file]);
    out.push({ file, offset: off });
  }
  return out;
};
