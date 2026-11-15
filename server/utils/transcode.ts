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
