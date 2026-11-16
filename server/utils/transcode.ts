// ffmpeg: probe + HLS transcode. ponytail: in-process child process, no queue;
// move to BullMQ when Phase 2 adds long-running AI jobs.
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const run = (cmd: string, args: string[]) =>
  new Promise<string>((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err.slice(-500)))));
  });

/** Returns duration in seconds; throws when the file is not a playable video. */
export const probeDuration = async (file: string): Promise<number> => {
  const out = await run("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "format=duration", "-of", "csv=p=0", file,
  ]);
  const d = parseFloat(out.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error("not a video");
  return d;
};

export const toHls = async (src: string, outDir: string) => {
  fs.mkdirSync(outDir, { recursive: true });
  await run("ffmpeg", [
    "-y", "-i", src, "-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264", "-preset", "veryfast",
    "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-hls_time", "6", "-hls_playlist_type", "vod",
    "-hls_segment_filename", path.join(outDir, "seg_%04d.ts"), path.join(outDir, "index.m3u8"),
  ]);
};

/** Mono 16 kHz 32 kbps mp3: ~14 MB/hour, so Whisper's 25 MB cap allows ~100 min. */
export const extractAudio = (src: string, out: string) =>
  run("ffmpeg", ["-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", out]);

export const frameTimes = (duration: number, count = 12) =>
  Array.from({ length: count }, (_, i) => duration * (0.05 + (0.9 * i) / Math.max(1, count - 1)));

export const frameAt = (src: string, t: number, out: string, width: number) =>
  run("ffmpeg", ["-y", "-ss", t.toFixed(2), "-i", src, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "2", out]);

/** Evenly spaced jpg frames (640 px wide), skipping the first/last 5%. Returns file paths. */
export const sampleFrames = async (src: string, duration: number, outDir: string, count = 12) => {
  fs.mkdirSync(outDir, { recursive: true });
  const files: string[] = [];
  for (const [i, t] of frameTimes(duration, count).entries()) {
    const f = path.join(outDir, `frame_${String(i).padStart(2, "0")}.jpg`);
    await frameAt(src, t, f, 640);
    files.push(f);
  }
  return files;
};

/** Instagram-safe mp4: H.264/AAC, <=1080 wide, moov atom first. */
export const toMp4 = (src: string, out: string) =>
  run("ffmpeg", ["-y", "-i", src, "-vf", "scale='min(1080,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out]);

/** Duration of an audio-only file in seconds; throws when it is not playable audio. */
export const probeAudioDuration = async (file: string): Promise<number> => {
  const out = await run("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  const d = parseFloat(out.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error("not audio");
  return d;
};

/** Voice note -> AAC m4a (plays in every browser). Mono, 48 kbps is plenty for speech. */
export const toVoiceM4a = (src: string, out: string) =>
  run("ffmpeg", ["-y", "-i", src, "-vn", "-ac", "1", "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart", out]);
