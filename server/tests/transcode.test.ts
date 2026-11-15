// Runs real ffmpeg on a 2s generated clip; skipped when ffmpeg is absent.
import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { probeDuration, toHls } from "../utils/transcode";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

describe.skipIf(!hasFfmpeg)("transcode", () => {
  it("probes duration, makes HLS, rejects non-video", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-"));
    const src = path.join(dir, "a.mp4");
    spawnSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=15", "-f", "lavfi", "-i", "sine=duration=2", "-shortest", src]);
    expect(await probeDuration(src)).toBeGreaterThan(1.5);
    await toHls(src, path.join(dir, "hls"));
    expect(fs.readFileSync(path.join(dir, "hls/index.m3u8"), "utf8")).toContain("seg_0000.ts");
    const bad = path.join(dir, "x.mp4");
    fs.writeFileSync(bad, "not a video");
    await expect(probeDuration(bad)).rejects.toThrow();
  }, 60000);
});
