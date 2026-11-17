// Real measurements of a rendered file. Anything that cannot be measured is left undefined,
// never defaulted to a passing value.
import { run } from "../../utils/transcode";
import { Measured } from "./provider";

export const measureFile = async (file: string): Promise<Measured> => {
  const j = JSON.parse(await run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]));
  const v = j.streams.find((s: any) => s.codec_type === "video");
  if (!v) throw new Error("output has no video stream");
  const hasAudio = j.streams.some((s: any) => s.codec_type === "audio");
  const [n, d] = String(v.avg_frame_rate).split("/").map(Number);
  const m: Measured = {
    width: v.width, height: v.height, fps: d ? n! / d : NaN,
    duration: parseFloat(j.format.duration), hasAudio,
  };
  if (hasAudio) m.integratedLufs = await loudness(file);
  return m;
};

/** EBU R128 integrated loudness via ffmpeg's ebur128 filter (summary printed on stderr). */
export const loudness = async (file: string): Promise<number | undefined> => {
  try {
    const err = await runStderr(file);
    const m = err.match(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/);
    return m ? parseFloat(m[1]!) : undefined;
  } catch { return undefined; }
};
import { spawn } from "child_process";
const runStderr = (file: string) => new Promise<string>((res, rej) => {
  const p = spawn("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  let e = ""; p.stderr.on("data", (d) => (e += d)); p.on("error", rej);
  p.on("close", (c) => (c === 0 ? res(e) : rej(new Error(e.slice(-300)))));
});

/** Silent spans in SOURCE time, measured with ffmpeg silencedetect. */
export const detectSilences = async (file: string, o: { noiseDb?: number; minSeconds?: number } = {}) => {
  const err = await new Promise<string>((res, rej) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", `silencedetect=noise=${o.noiseDb ?? -35}dB:d=${o.minSeconds ?? 0.4}`, "-f", "null", "-"]);
    let e = ""; p.stderr.on("data", (d) => (e += d)); p.on("error", rej); p.on("close", () => res(e));
  });
  const out: { start: number; end: number }[] = [];
  let open: number | null = null;
  for (const m of err.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    const v = parseFloat(m[2]!);
    if (m[1] === "start") open = Math.max(0, v);
    else if (open !== null) { out.push({ start: open, end: v }); open = null; }
  }
  return out;
};
