import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { SKILLS, renderSkillMd } from "../reel/skills";
import { buildPhrases, selectionToOps } from "../reel/skills/talkingHead";
import { checkQuality } from "../reel/skills/qualityController";
import { EDIT_OPS } from "../reel/registry";
import * as ops from "../reel/ops";
import { ffmpegProvider } from "../reel/render/ffmpeg";
import { makeSampleVideo } from "../utils/transcode";

describe("skill definitions", () => {
  it("every skill is complete and only names registered operations", () => {
    const names = new Set(EDIT_OPS.map((o) => o.name));
    for (const s of SKILLS) {
      expect(s.rules.length, s.name).toBeGreaterThan(2);
      expect(s.decisionCriteria.length).toBeGreaterThan(0);
      expect(s.escalation.length).toBeGreaterThan(1);
      expect(s.operations.every((o) => names.has(o)), s.name).toBe(true);
    }
  });
  it("committed SKILL.md files match the definitions", () => {
    for (const s of SKILLS) expect(fs.readFileSync(path.join(__dirname, "../reel/skills", s.name, "SKILL.md"), "utf8")).toBe(renderSkillMd(s));
  });
  for (const s of SKILLS) for (const c of s.evalCases)
    it(`eval: ${s.name}: ${c.name}`, () => { const r = c.expect(s.analyze(c.input)); expect(r === true, String(r)).toBe(true); });
});

const src = { storageKey: "x", duration: 30, width: 1920, height: 1080, hasAudio: true };
const W = (w: string, s: number, e: number) => ({ w, start: s, end: e });
// hand-written TEST INPUT (not a model or ASR result)
const words = [W("Hello", 0, .4), W("friends.", .5, 1), W("um", 2, 2.3), W("This", 6, 6.3), W("is", 6.4, 6.5), W("the", 6.6, 6.7), W("point.", 6.8, 7.4), W("Bye", 20, 20.4), W("now.", 20.5, 21)];

describe("story selection to operations", () => {
  const t = ops.fromSource("p", "a", src);
  const ph = buildPhrases(words);
  it("cuts everything outside the kept phrases, latest range first, and the result is a valid shorter timeline", () => {
    expect(ph.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
    const sel = { hookPhraseId: "p3", keepPhraseIds: ["p3"], rationale: "states the point directly" };
    const r = selectionToOps(t, "a", ph, sel);
    expect(r.steps.map((s) => s.args.from)).toEqual([...r.steps.map((s) => s.args.from)].sort((a, b) => b - a));
    let cur = t; for (const s of r.steps) cur = ops.removeRange(cur, s.args.from, s.args.to);
    expect(ops.totalDuration(cur)).toBeCloseTo(r.keptSeconds, 2);
    expect(r.keptSeconds).toBeCloseTo(7.4 - 6 + 0.3, 1); // phrase 1.4 s + 0.15 pad each side
    expect(r.warnings).toEqual([]);
  });
  it("rejects unknown ids, missing hook, duplicates", () => {
    expect(() => selectionToOps(t, "a", ph, { hookPhraseId: "p3", keepPhraseIds: ["p9"], rationale: "x".repeat(12) })).toThrow(/unknown phrase/);
    expect(() => selectionToOps(t, "a", ph, { hookPhraseId: "p1", keepPhraseIds: ["p3"], rationale: "x".repeat(12) })).toThrow(/hook phrase must be/);
    expect(() => selectionToOps(t, "a", ph, { hookPhraseId: "p3", keepPhraseIds: ["p3", "p3"], rationale: "x".repeat(12) })).toThrow(/duplicate/);
  });
  it("moves a later hook to the start non-destructively and can be switched off", () => {
    const sel = { hookPhraseId: "p4", keepPhraseIds: ["p1", "p4"], rationale: "x".repeat(12) };
    const r = selectionToOps(t, "a", ph, sel);
    expect(r.steps.at(-1)!.op).toBe("move_segment");
    expect(r.warnings[0]).toMatch(/moved to the start/);
    let cur = t;
    for (const s of r.steps) cur = s.op === "move_segment" ? ops.moveSegment(cur, s.args.from, s.args.to, s.args.at) : ops.removeRange(cur, s.args.from, s.args.to);
    const first = cur.tracks[0]!.clips[0]!;
    expect(first.in!).toBeCloseTo(20 - 0.15, 1); // hook phrase (starts at 20 s in the source) now opens the timeline
    expect(ops.totalDuration(cur)).toBeCloseTo(r.keptSeconds, 1); // moving deletes nothing
    const keep = selectionToOps(t, "a", ph, { ...sel, moveHook: false });
    expect(keep.steps.some((s) => s.op === "move_segment")).toBe(false);
  });
});

describe("quality controller on a real render", () => {
  it("reports measured loudness/resolution, marks unmeasured as not_measured, proposes a fix when loudness fails", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qc-"));
    await makeSampleVideo(path.join(dir, "s.mp4"), "testsrc2", 4); // sine tone: not -16 LUFS
    const t = ops.fromSource("p", "s", { storageKey: "s.mp4", duration: 4, width: 640, height: 360, hasAudio: true });
    const res = await ffmpegProvider.render(t, { quality: "preview", outFile: path.join(dir, "o.mp4"), workDir: path.join(dir, "w"), resolveSource: (k) => path.join(dir, k) });
    const out = checkQuality({ timeline: t, assets: [], render: res.measured });
    const by = Object.fromEntries(out.checks.map((c) => [c.name, c]));
    expect(by["rendered resolution"]!.status).toBe("pass");
    expect(by["integrated loudness"]!.measured).toBeTypeOf("number");
    expect(out.passed).toBe(by["integrated loudness"]!.status !== "fail");
    if (by["integrated loudness"]!.status === "fail") expect(out.recommendations[0]!.op).toBe("set_clip_audio");
    const none = checkQuality({ timeline: t, assets: [] });
    expect(none.checks.filter((c) => c.status === "not_measured").length).toBe(4);
    expect(none.passed).toBe(true); // nothing measured failed, but it must not claim loudness passed
    expect(none.checks.find((c) => c.name === "integrated loudness")!.status).toBe("not_measured");
  }, 60000);
  it("flags captions that are too long/fast", () => {
    let t = ops.fromSource("p", "a", src);
    t = ops.addCaptions(t, "a", [W("a".repeat(30), 0, .2), W("b".repeat(30), .2, .4)], { maxWords: 4 });
    const out = checkQuality({ timeline: t, assets: [], transcript: { assetId: "a", words: [] } });
    expect(out.checks.find((c) => c.name === "caption line length")!.status).toBe("fail");
    expect(out.checks.find((c) => c.name === "caption reading speed")!.status).toBe("fail");
  });
});
