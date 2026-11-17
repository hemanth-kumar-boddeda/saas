import { describe, it, expect } from "vitest";
import { validate } from "../reel/schema";
import * as ops from "../reel/ops";

const src = { storageKey: "projects/p/a/source.mp4", duration: 60, width: 1920, height: 1080, hasAudio: true };
const base = () => ops.fromSource("p1", "s1", src);
const words = [
  { w: "నమస్కారం", roman: "namaskaram", start: 1, end: 1.4 },
  { w: "friends", start: 1.5, end: 2 },
  { w: "today", start: 20, end: 20.4 },
  { w: "ok", start: 40, end: 40.3 },
];

describe("timeline schema", () => {
  it("fresh timeline is valid and linked", () => {
    const t = base();
    expect(validate(t)).toEqual([]);
    expect(t.tracks.map((x) => x.id)).toEqual(["v1", "a1"]);
  });
  it("detects out beyond source, overlap, unknown source", () => {
    const t = base();
    t.tracks[0]!.clips[0]!.out = 99;
    expect(validate(t).join()).toMatch(/beyond source/);
    const u = base(); u.tracks[0]!.clips[0]!.sourceId = "zz";
    expect(validate(u).join()).toMatch(/unknown source/);
    const v = base(); v.tracks[0]!.clips.push({ ...v.tracks[0]!.clips[0]!, id: "dup2" });
    expect(validate(v).join()).toMatch(/overlap/);
  });
});

describe("edit ops", () => {
  it("never mutates the input and bumps version/parent", () => {
    const t = base(); const snap = JSON.stringify(t);
    const n = ops.splitClip(t, t.tracks[0]!.clips[0]!.id, 10);
    expect(JSON.stringify(t)).toBe(snap);
    expect([n.version, n.parent]).toEqual([2, 1]);
  });
  it("editing an approved timeline forks an unapproved child", () => {
    const t = { ...base(), approved: true };
    const n = ops.trimClip(t, t.tracks[0]!.clips[0]!.id, { in: 2 });
    expect(t.approved).toBe(true);
    expect(n.approved).toBe(false);
  });
  it("split keeps linked audio in sync", () => {
    const t = base(); const n = ops.splitClip(t, t.tracks[0]!.clips[0]!.id, 10);
    expect(n.tracks[0]!.clips).toHaveLength(2);
    expect(n.tracks[1]!.clips.map((c) => [c.start, c.in])).toEqual([[0, 0], [10, 10]]);
    expect(n.tracks[0]!.clips[1]!.group).toBe(n.tracks[1]!.clips[1]!.group);
  });
  it("split rejects points outside the clip", () => {
    const t = base();
    expect(() => ops.splitClip(t, t.tracks[0]!.clips[0]!.id, 0)).toThrow(/inside/);
  });
  it("removeRange ripples all tracks", () => {
    const n = ops.removeRange(base(), 10, 20);
    expect(ops.totalDuration(n)).toBeCloseTo(50);
    for (const tr of n.tracks) expect(tr.clips.map((c) => [c.start, c.in, c.out])).toEqual([[0, 0, 10], [10, 20, 60]]);
  });
  it("removeRange rejects ranges beyond the timeline", () => {
    expect(() => ops.removeRange(base(), 50, 70)).toThrow(/long/);
  });
  it("removeSilences cuts only long silences and keeps padding", () => {
    const n = ops.removeSilences(base(), "s1", [{ start: 5, end: 8 }, { start: 30, end: 30.2 }], { minSilence: 0.5, pad: 0.1 });
    expect(ops.totalDuration(n)).toBeCloseTo(60 - 2.8);
    expect(n.tracks[0]!.clips).toHaveLength(2);
  });
  it("reorder moves linked audio with video", () => {
    const b0 = base(); const t = ops.splitClip(b0, b0.tracks[0]!.clips[0]!.id, 10);
    const [a, b] = t.tracks[0]!.clips;
    const n = ops.reorderClips(t, "v1", [b!.id, a!.id]);
    const v = n.tracks[0]!.clips.find((c) => c.id === b!.id)!;
    const au = n.tracks[1]!.clips.find((c) => c.group === v.group)!;
    expect([v.start, au.start]).toEqual([0, 0]);
    expect(au.in).toBe(10);
  });
  it("reorder rejects incomplete lists", () => {
    const b0 = base(); const t = ops.splitClip(b0, b0.tracks[0]!.clips[0]!.id, 10);
    expect(() => ops.reorderClips(t, "v1", [t.tracks[0]!.clips[0]!.id])).toThrow(/every clip/);
  });
  it("reframeVertical crops 16:9 to a centred 9:16 window", () => {
    const n = ops.reframeVertical(base(), 0.5);
    const c = n.tracks[0]!.clips[0]!.transform!.crop!;
    expect(c.w).toBeCloseTo((1080 * 9) / 16 / 1920);
    expect(c.x + c.w / 2).toBeCloseTo(0.5);
    expect([n.output.width, n.output.height]).toEqual([1080, 1920]);
    expect(ops.reframeVertical(base(), 0).tracks[0]!.clips[0]!.transform!.crop!.x).toBe(0);
  });
  it("captions map source words through cuts and drop removed words", () => {
    const cut = ops.removeRange(base(), 10, 30); // drops "today" (20s)
    const n = ops.addCaptions(cut, "s1", words, { script: "roman" });
    const flat = n.tracks.find((x) => x.id === "captions")!.clips.flatMap((c) => c.words!);
    expect(flat.map((w) => w.w)).toEqual(["నమస్కారం", "friends", "ok"]);
    expect(flat[2]!.start).toBeCloseTo(20); // 40 - 20 removed
    expect(n.tracks.find((x) => x.id === "captions")!.clips[0]!.captionStyle!.script).toBe("roman");
  });
  it("captions fail when no words survive", () => {
    expect(() => ops.addCaptions(base(), "s1", [{ w: "x", start: 100, end: 101 }])).toThrow(/no transcript words/);
  });
  it("switchCamera swaps source with sync offset and rejects uncovered range", () => {
    const t = base();
    t.sources.s2 = { storageKey: "k2", duration: 30, hasAudio: true, offset: 5 };
    const n = ops.switchCamera(t, 12, "s2", 20);
    const c = n.tracks[0]!.clips.find((x) => x.sourceId === "s2")!;
    expect([c.start, c.in, c.duration]).toEqual([12, 17, 8]); // common 12 + offset 5
    expect(n.tracks[0]!.clips).toHaveLength(3);
    expect(() => ops.switchCamera(t, 40, "s2")).toThrow(/does not cover/);
  });
  it("trim updates linked audio", () => {
    const t = base(); const n = ops.trimClip(t, t.tracks[0]!.clips[0]!.id, { in: 5, out: 25 });
    expect(n.tracks[1]!.clips[0]!.in).toBe(5);
    expect(n.tracks[1]!.clips[0]!.duration).toBe(20);
  });
});

describe("moveSegment", () => {
  const split = () => { let t = base(); t = ops.splitClip(t, t.tracks[0]!.clips[0]!.id, 20); return ops.splitClip(t, t.tracks[0]!.clips.find((c) => c.start >= 20)!.id, 40); };
  it("moves the last third to the front, keeps total length, source ranges and linked audio", () => {
    const t = split();
    const n = ops.moveSegment(t, 40, 60, 0);
    expect(ops.totalDuration(n)).toBeCloseTo(60);
    for (const tr of n.tracks) expect(tr.clips.map((c) => [c.start, c.in])).toEqual([[0, 40], [20, 0], [40, 20]]);
    expect(n.tracks[0]!.clips[0]!.group).toBe(n.tracks[1]!.clips[0]!.group);
    expect(validate(n)).toEqual([]);
  });
  it("splits a clip when the range is inside it, and moves later or earlier", () => {
    const t = base();
    const n = ops.moveSegment(t, 10, 20, 0); // inside one 60 s clip
    expect(n.tracks[0]!.clips.map((c) => [c.start, c.in, c.out])).toEqual([[0, 10, 20], [10, 0, 10], [20, 20, 60]]);
    const m2 = ops.moveSegment(t, 0, 10, 50); // to the end
    expect(m2.tracks[0]!.clips.map((c) => [c.start, c.in])).toEqual([[0, 10], [50, 0]]);
  });
  it("is non-destructive: input and approved versions untouched, child unapproved", () => {
    const t = { ...split(), approved: true }; const snap = JSON.stringify(t);
    const n = ops.moveSegment(t, 40, 60, 0);
    expect(JSON.stringify(t)).toBe(snap); expect([n.approved, n.parent]).toEqual([false, t.version]);
  });
  it("moves caption words with the picture", () => {
    let t = ops.addCaptions(split(), "s1", [{ w: "late", start: 45, end: 46 }, { w: "early", start: 5, end: 6 }]);
    t = ops.moveSegment(t, 40, 60, 0);
    const words = t.tracks.find((x) => x.id === "captions")!.clips.flatMap((c) => c.words!).map((w) => [w.w, +w.start.toFixed(1)]);
    expect(words).toEqual([["late", 5], ["early", 25]]);
  });
  it("rejects out-of-range, no-op and mid-timeline nonsense", () => {
    const t = base();
    expect(() => ops.moveSegment(t, 50, 70, 0)).toThrow(/outside/);
    expect(() => ops.moveSegment(t, 10, 20, 10)).toThrow(/already/);
    expect(() => ops.moveSegment(t, 10, 20, 55)).toThrow(/outside/);
  });
});
