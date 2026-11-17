// ffmpeg adapter: Timeline -> one filter_complex. The agent and API never build ffmpeg commands.
// v1 limits (checked, not silently ignored): the first video track and the first audio track must be
// gap-free from 0; transitions other than cut are rejected; keyframes are not rendered yet.
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { Clip, Timeline, clipEnd, totalDuration, validate } from "../schema";
import { RenderOptions, RenderProvider, RenderResult } from "./provider";
import { captionPng } from "./captionPng";
import { measureFile } from "./measure";

export class RenderError extends Error {}
const f = (n: number) => n.toFixed(4);

const contiguous = (clips: Clip[], what: string) => {
  let t = 0;
  for (const c of clips) {
    if (Math.abs(c.start - t) > 1e-3) throw new RenderError(`${what}: gap or overlap at ${f(t)}s (v1 needs gap-free tracks)`);
    t = clipEnd(c);
  }
};

export interface Plan { args: string[]; overlays: { clip: Clip }[] }

/** Pure: builds ffmpeg args. `pngFor` maps an overlay clip id to its PNG path. */
export const buildPlan = (t: Timeline, o: Pick<RenderOptions, "quality" | "outFile" | "resolveSource">, pngFor: (id: string) => string): Plan => {
  const issues = validate(t);
  if (issues.length) throw new RenderError(`invalid timeline: ${issues[0]}`);
  const vt = t.tracks.find((x) => x.kind === "video");
  if (!vt?.clips.length) throw new RenderError("no video track");
  const vclips = [...vt.clips].sort((a, b) => a.start - b.start);
  contiguous(vclips, "video track");
  const at = t.tracks.find((x) => x.kind === "audio");
  const aclips = at ? [...at.clips].sort((a, b) => a.start - b.start) : [];
  if (aclips.length) contiguous(aclips, "audio track");
  for (const c of [...vclips, ...aclips]) if (c.transition && c.transition.type !== "cut") throw new RenderError(`clip ${c.id}: ${c.transition.type} transitions are not rendered yet`);

  const { width: W, height: H, fps } = t.output;
  const inputs: string[] = [];
  const idx = new Map<string, number>();
  const input = (key: string) => {
    if (!idx.has(key)) { idx.set(key, inputs.length / 2); inputs.push("-i", o.resolveSource(key)); }
    return idx.get(key)!;
  };
  const g: string[] = [];
  vclips.forEach((c, k) => {
    const i = input(t.sources[c.sourceId!]!.storageKey);
    const cr = c.transform?.crop;
    const crop = cr ? `crop=iw*${f(cr.w)}:ih*${f(cr.h)}:iw*${f(cr.x)}:ih*${f(cr.y)},` : "";
    g.push(`[${i}:v]trim=start=${f(c.in!)}:end=${f(c.out!)},setpts=PTS-STARTPTS,${crop}scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${fps}[v${k}]`);
  });
  g.push(`${vclips.map((_, k) => `[v${k}]`).join("")}concat=n=${vclips.length}:v=1:a=0[vbase]`);

  let last = "vbase";
  const overlays = t.tracks.filter((x) => x.kind === "caption" || x.kind === "overlay").flatMap((x) => x.clips.map((clip) => ({ clip })));
  const base = inputs.length / 2;
  overlays.forEach(({ clip }, k) => {
    inputs.push("-i", pngFor(clip.id));
    const out = `o${k}`;
    g.push(`[${last}][${base + k}:v]overlay=0:0:enable='between(t,${f(clip.start)},${f(clipEnd(clip))})'[${out}]`);
    last = out;
  });

  const maps = ["-map", `[${last}]`];
  if (aclips.length) {
    aclips.forEach((c, k) => {
      const i = input(t.sources[c.sourceId!]!.storageKey);
      const a = c.audio;
      const fades = [a?.fadeIn ? `afade=t=in:d=${f(a.fadeIn)}` : "", a?.fadeOut ? `afade=t=out:st=${f(c.duration - a.fadeOut)}:d=${f(a.fadeOut)}` : ""].filter(Boolean);
      g.push(`[${i}:a]atrim=start=${f(c.in!)}:end=${f(c.out!)},asetpts=PTS-STARTPTS,volume=${a?.gainDb ?? 0}dB${fades.length ? "," + fades.join(",") : ""}[a${k}]`);
    });
    const enhance = aclips.some((c) => c.audio?.enhance === "dialogue");
    const tail = enhance ? ",highpass=f=80,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11" : "";
    g.push(`${aclips.map((_, k) => `[a${k}]`).join("")}concat=n=${aclips.length}:v=0:a=1${tail}[aout]`);
    maps.push("-map", "[aout]");
  }
  const crf = o.quality === "preview" ? "28" : "20";
  const args = [
    "-y", "-hide_banner", "-nostats", ...inputs, "-filter_complex", g.join(";"), ...maps,
    "-c:v", "libx264", "-preset", o.quality === "preview" ? "veryfast" : "medium", "-crf", crf, "-pix_fmt", "yuv420p",
    ...(aclips.length ? ["-c:a", "aac", "-b:a", "160k"] : []),
    "-t", f(totalDuration(t)), "-movflags", "+faststart", "-progress", "pipe:1", o.outFile,
  ];
  return { args, overlays };
};

const exec = (args: string[], total: number, onProgress?: (p: number) => void | Promise<void>) =>
  new Promise<void>((resolve, reject) => {
    const p = spawn("ffmpeg", args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.stdout.on("data", (d) => {
      const m = String(d).match(/out_time_us=(\d+)/g);
      if (m && onProgress) void onProgress(Math.min(0.99, parseInt(m[m.length - 1]!.split("=")[1]!, 10) / 1e6 / total));
    });
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new RenderError(err.slice(-600)))));
  });

export const ffmpegProvider: RenderProvider = {
  name: "ffmpeg",
  async render(t, o): Promise<RenderResult> {
    const started = Date.now();
    fs.mkdirSync(o.workDir, { recursive: true });
    fs.mkdirSync(path.dirname(o.outFile), { recursive: true });
    const pngs = new Map<string, string>();
    for (const tr of t.tracks) if (tr.kind === "caption" || tr.kind === "overlay")
      for (const c of tr.clips) {
        const p = path.join(o.workDir, `${c.id}.png`);
        await captionPng(c, t.output.width, t.output.height, p);
        pngs.set(c.id, p);
      }
    const plan = buildPlan(t, o, (id) => pngs.get(id)!);
    await exec(plan.args, totalDuration(t), o.onProgress);
    const measured = await measureFile(o.outFile);
    return { outFile: o.outFile, measured, renderSeconds: (Date.now() - started) / 1000 };
  },
};
