import { describe, it, expect } from "vitest";
import {
  parseModelJson, copyOutput, tagsOutput, frameRanking, kitEdit, channelInput,
  srtTime, toSrt, chapterLines, bestFrames, clipTranscript, channelContext,
} from "../services/publishKitLogic";

const copy = { titles: ["a", "b", "c"], description: "d", chapters: [{ start: 0, title: "Intro" }] };

describe("parseModelJson", () => {
  it("parses bare JSON", () => {
    const r = parseModelJson(JSON.stringify(copy), copyOutput);
    expect(r.ok && r.data.titles).toEqual(["a", "b", "c"]);
  });
  it("parses fenced JSON with chatter around it", () => {
    const r = parseModelJson("Sure!\n```json\n" + JSON.stringify(copy) + "\n```\nHope it helps", copyOutput);
    expect(r.ok).toBe(true);
  });
  it("trims strings via schema", () => {
    const r = parseModelJson(JSON.stringify({ ...copy, titles: [" a ", "b", "c"] }), copyOutput);
    expect(r.ok && r.data.titles[0]).toBe("a");
  });
  it("reports missing JSON", () => {
    expect(parseModelJson("no json here", copyOutput)).toEqual({ ok: false, error: "no JSON object found" });
  });
  it("reports malformed JSON", () => {
    const r = parseModelJson('{"titles": [', copyOutput);
    expect(!r.ok && r.error).toMatch(/no JSON|invalid JSON/);
    const r2 = parseModelJson("{titles: 1}", copyOutput);
    expect(!r2.ok && r2.error).toMatch(/invalid JSON/);
  });
  it("reports schema violations with the path", () => {
    const r = parseModelJson(JSON.stringify({ ...copy, titles: ["a", "b"] }), copyOutput);
    expect(!r.ok && r.error).toMatch(/titles/);
  });
  it("rejects wrong types", () => {
    expect(parseModelJson('{"rankings":[{"index":-1,"score":50,"reason":"x"}]}', frameRanking).ok).toBe(false);
    expect(parseModelJson('{"rankings":[{"index":0,"score":101,"reason":"x"}]}', frameRanking).ok).toBe(false);
    expect(parseModelJson('{"rankings":[]}', frameRanking).ok).toBe(false);
  });
  it("requires exactly 3 thumbnail texts and bounded text length", () => {
    const base = { hashtags: ["#a"], tags: ["a"], thumbnailTexts: ["x", "y", "z"] };
    expect(parseModelJson(JSON.stringify(base), tagsOutput).ok).toBe(true);
    expect(parseModelJson(JSON.stringify({ ...base, thumbnailTexts: ["x", "y"] }), tagsOutput).ok).toBe(false);
    expect(parseModelJson(JSON.stringify({ ...base, thumbnailTexts: ["x", "y", "z".repeat(40)] }), tagsOutput).ok).toBe(false);
  });
});

describe("srt", () => {
  it("formats times", () => {
    expect(srtTime(0)).toBe("00:00:00,000");
    expect(srtTime(3661.5)).toBe("01:01:01,500");
    expect(srtTime(-4)).toBe("00:00:00,000");
  });
  it("numbers cues, skips empty/zero-length ones", () => {
    const srt = toSrt([
      { start: 0, end: 2, text: " Hello " },
      { start: 2, end: 2, text: "zero" },
      { start: 2, end: 4, text: "  " },
      { start: 4, end: 5.25, text: "World" },
    ]);
    expect(srt).toBe("1\n00:00:00,000 --> 00:00:02,000\nHello\n\n2\n00:00:04,000 --> 00:00:05,250\nWorld\n");
  });
});

describe("chapterLines", () => {
  it("sorts, drops out-of-range, prepends 0:00 when missing", () => {
    const l = chapterLines([{ start: 125, title: "B" }, { start: 30, title: "A" }, { start: 999, title: "late" }], 300);
    expect(l).toEqual(["0:00 Intro", "0:30 A", "2:05 B"]);
  });
  it("uses h:mm:ss over an hour", () => {
    expect(chapterLines([{ start: 0, title: "A" }, { start: 3725, title: "B" }], 4000)).toEqual(["0:00 A", "1:02:05 B"]);
  });
  it("returns nothing for no chapters", () => expect(chapterLines([], 60)).toEqual([]));
});

describe("bestFrames", () => {
  it("orders by score, drops duplicates and out-of-range", () => {
    const r = bestFrames([{ index: 1, score: 40 }, { index: 9, score: 99 }, { index: 2, score: 80 }, { index: 2, score: 70 }, { index: 0, score: 60 }], 4);
    expect(r.map((x) => x.index)).toEqual([2, 0, 1]);
  });
});

describe("kitEdit / channelInput", () => {
  it("allows partial edits but validates them", () => {
    expect(kitEdit.safeParse({ description: "new" }).success).toBe(true);
    expect(kitEdit.safeParse({ titles: ["a"] }).success).toBe(false);
    expect(kitEdit.safeParse({ chosenThumbnail: 3 }).success).toBe(false);
  });
  it("rejects bad brand colors and fills defaults", () => {
    expect(channelInput.safeParse({ name: "x", brand: { primary: "red", secondary: "#fff", accent: "#000" } }).success).toBe(false);
    const c = channelInput.parse({ name: "x" });
    expect(c.brand.accent).toMatch(/^#/);
  });
});

describe("helpers", () => {
  it("clips long transcripts", () => {
    expect(clipTranscript("abc", 10)).toBe("abc");
    expect(clipTranscript("a".repeat(20), 10)).toMatch(/truncated/);
  });
  it("injects channel profile", () => {
    expect(channelContext({ name: "Tech", niche: "gadgets", tone: "witty" })).toMatch(/Niche: gadgets/);
    expect(channelContext(null)).toMatch(/none set/);
  });
});
