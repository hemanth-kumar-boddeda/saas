import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import * as ops from "../reel/ops";
import { buildPlan, ffmpegProvider } from "../reel/render/ffmpeg";
import { makeSampleVideo, probeDuration } from "../utils/transcode";

const hasFfmpeg = (() => { try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return true; } catch { return false; } })();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));
const srcFile = path.join(dir, "src.mp4");
const mkTimeline = () => ops.fromSource("p", "s1", { storageKey: "src.mp4", duration: 8, width: 640, height: 360, hasAudio: true });

describe("buildPlan (pure)", () => {
  it("builds trim/concat/crop graph and enhancement chain", () => {
    let t = mkTimeline();
    t = ops.reframeVertical(t, 0.5);
    t = ops.setClipAudio(t, t.tracks[1]!.clips[0]!.id, { gainDb: 0, fadeIn: 0, fadeOut: 0, enhance: "dialogue" });
    const { args } = buildPlan(t, { quality: "preview", outFile: "o.mp4", resolveSource: (k) => k }, () => "x.png");
    const g = args[args.indexOf("-filter_complex") + 1]!;
    expect(g).toMatch(/crop=iw\*0\.\d+:ih\*1\.0000/);
    expect(g).toContain("scale=1080:1920");
    expect(g).toContain("loudnorm=I=-16");
    expect(args).toContain("28");
  });
  it("rejects gaps and unsupported transitions instead of ignoring them", () => {
    const t = mkTimeline(); t.tracks[0]!.clips[0]!.start = 1;
    expect(() => buildPlan(t, { quality: "preview", outFile: "o", resolveSource: (k) => k }, () => "")).toThrow(/gap/);
    const m = mkTimeline();
    const u = ops.setTransition(m, m.tracks[0]!.clips[0]!.id, { type: "fade", duration: 1 });
    expect(() => buildPlan(u, { quality: "preview", outFile: "o", resolveSource: (k) => k }, () => "")).toThrow(/not rendered yet/);
  });
});

describe.skipIf(!hasFfmpeg)("real ffmpeg render", () => {
  beforeAll(async () => { await makeSampleVideo(srcFile, "testsrc2", 8); }, 30000);
  it("renders an edited timeline to a playable vertical mp4 and measures it", async () => {
    let t = ops.fromSource("p", "s1", { storageKey: "src.mp4", duration: await probeDuration(srcFile), width: 640, height: 360, hasAudio: true });
    t = ops.removeRange(t, 2, 4);
    t = ops.reframeVertical(t, 0.5);
    t = ops.addCaptions(t, "s1", [{ w: "hello", start: 0.5, end: 1 }, { w: "world", start: 5, end: 5.5 }, { w: "cut", start: 3, end: 3.4 }]);
    t = ops.setClipAudio(t, t.tracks[1]!.clips[0]!.id, { gainDb: 0, fadeIn: 0, fadeOut: 0, enhance: "dialogue" });
    const out = path.join(dir, "out.mp4");
    const res = await ffmpegProvider.render(t, { quality: "preview", outFile: out, workDir: path.join(dir, "w"), resolveSource: (k) => path.join(dir, k) });
    expect(await probeDuration(out)).toBeCloseTo(6, 0);
    expect([res.measured.width, res.measured.height]).toEqual([1080, 1920]);
    expect(res.measured.hasAudio).toBe(true);
    expect(res.measured.integratedLufs).toBeTypeOf("number");
    // the captioned frame differs from the same frame without captions
    const grab = (file: string, name: string) => { const p = path.join(dir, name); execFileSync("ffmpeg", ["-y", "-ss", "0.7", "-i", file, "-frames:v", "1", p], { stdio: "ignore" }); return fs.readFileSync(p); };
    const noCap = ops.removeRange(ops.reframeVertical(ops.fromSource("p", "s1", { storageKey: "src.mp4", duration: 8, width: 640, height: 360, hasAudio: true }), 0.5), 2, 4);
    const out2 = path.join(dir, "out2.mp4");
    await ffmpegProvider.render(noCap, { quality: "preview", outFile: out2, workDir: path.join(dir, "w2"), resolveSource: (k) => path.join(dir, k) });
    expect(grab(out, "a.png").equals(grab(out2, "b.png"))).toBe(false);
  }, 90000);
});

import { FONT } from "../reel/render/captionPng";
describe("caption font stack", () => {
  it("never lists a font that breaks Telugu shaping and starts with a Telugu font", () => {
    expect(FONT).not.toMatch(/Arial Unicode/);
    expect(FONT.split(",")[0]).toMatch(/Telugu/);
  });
});

describe.skipIf(!hasFfmpeg)("hook reposition renders the right pixels", () => {
  it("red 0-4s, green 4-8s, blue 8-12s: moving blue to the front makes the first frames blue and audio follows", async () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "hook-"));
    const f = path.join(d, "rgb.mp4");
    execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=red:s=320x180:r=24:d=4", "-f", "lavfi", "-i", "color=c=green:s=320x180:r=24:d=4", "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=24:d=4",
      "-f", "lavfi", "-i", "sine=frequency=300:d=4", "-f", "lavfi", "-i", "sine=frequency=900:d=4", "-f", "lavfi", "-i", "sine=frequency=1800:d=4",
      "-filter_complex", "[0][1][2]concat=n=3:v=1:a=0[v];[3][4][5]concat=n=3:v=0:a=1[a]", "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", f], { stdio: "ignore" });
    let t = ops.fromSource("p", "s", { storageKey: "rgb.mp4", duration: 12, width: 320, height: 180, hasAudio: true });
    t = ops.moveSegment(t, 8, 12, 0);
    const out = path.join(d, "o.mp4");
    await ffmpegProvider.render(t, { quality: "preview", outFile: out, workDir: path.join(d, "w"), resolveSource: (k) => path.join(d, k) });
    const px = (time: number) => { const o = path.join(d, `f${time}.raw`); execFileSync("ffmpeg", ["-y", "-ss", String(time), "-i", out, "-frames:v", "1", "-vf", "scale=1:1", "-pix_fmt", "rgb24", "-f", "rawvideo", o], { stdio: "ignore" }); return [...fs.readFileSync(o)]; };
    const [r1, g1, b1] = px(1)!; expect(b1!).toBeGreaterThan(150); expect(r1!).toBeLessThan(80);   // blue first
    const [r2, g2] = px(5)!; expect(r2!).toBeGreaterThan(150); expect(g2!).toBeLessThan(80);        // then red
    const [r3, g3] = px(9)!; expect(g3!).toBeGreaterThan(100); expect(r3!).toBeLessThan(80);        // then green
    expect(g1!).toBeLessThan(80);
  }, 60000);
});
