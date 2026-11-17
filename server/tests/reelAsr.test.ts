import { describe, it, expect } from "vitest";
import { cer, englishRecall, scriptOf, speakerAccuracy, termRecall, timingError, wer } from "../reel/benchmark/metrics";
import { manifestSchema, runBenchmark } from "../reel/benchmark/run";
import { parseSarvam } from "../reel/asr/sarvam";
import { parseWhisper } from "../reel/asr/groq";
import { sarvam } from "../reel/asr/sarvam";
import { pickAsr, asrStatus } from "../reel/asr";
import { ProviderNotConfigured } from "../reel/jobs";

describe("metrics", () => {
  it("WER/CER on Telugu text", () => {
    expect(wer("నేను ఇంటికి వెళ్తున్నాను", "నేను ఇంటికి వెళ్తున్నాను")).toBe(0);
    expect(wer("a b c d", "a x c")).toBeCloseTo(0.5);
    expect(cer("abcd", "abxd")).toBeCloseTo(0.25);
    expect(wer("", "x")).toBeNull();
  });
  it("detects script", () => {
    expect(scriptOf("నమస్కారం")).toBe("telugu");
    expect(scriptOf("namaskaram")).toBe("latin");
    expect(scriptOf("నమస్కారం friends hello meeting")).toBe("mixed");
  });
  it("timing error aligns by text and reports within-threshold shares", () => {
    const ref = [{ w: "a", start: 0, end: 1 }, { w: "b", start: 1, end: 2 }, { w: "c", start: 2, end: 3 }];
    const hyp = [{ w: "a", start: 0.05, end: 1 }, { w: "c", start: 2.3, end: 3 }];
    const t = timingError(ref, hyp)!;
    expect(t.matched).toBe(2);
    expect(t.within100).toBe(0.5);
    expect(t.meanMs).toBeCloseTo(175, 0);
    expect(timingError(ref, [{ w: "z", start: 0, end: 1 }])).toBeNull();
  });
  it("term, english and speaker metrics", () => {
    expect(termRecall(["Hyderabad", "API"], "we are in hyderabad now")).toBe(0.5);
    expect(englishRecall([{ w: "meeting", start: 0, end: 1, lang: "en" }, { w: "ఇల్లు", start: 1, end: 2 }], "meeting ఇల్లు")).toBe(1);
    const r = [{ w: "a", start: 0, end: 1, speaker: "X" }, { w: "b", start: 1, end: 2, speaker: "Y" }];
    expect(speakerAccuracy(r, [{ w: "a", start: 0, end: 1, speaker: "1" }, { w: "b", start: 1, end: 2, speaker: "2" }])).toBe(1);
    expect(speakerAccuracy(r, [{ w: "a", start: 0, end: 1 }])).toBeNull();
  });
});

describe("benchmark framework", () => {
  const item = { id: "1", audio: "a.wav", category: "code_switch", reference: { text: "hi" } };
  it("rejects items without explicit consent", () => {
    expect(manifestSchema.safeParse({ items: [item] }).success).toBe(false);
    expect(manifestSchema.safeParse({ items: [{ ...item, consent: { given: false, by: "x", date: "d" } }] }).success).toBe(false);
    expect(manifestSchema.safeParse({ items: [{ ...item, consent: { given: true, by: "creator", date: "2026-11-17" } }] }).success).toBe(true);
  });
  it("reports not_configured instead of running unconfigured providers", async () => {
    const saved = process.env.SARVAM_API_KEY; delete process.env.SARVAM_API_KEY;
    const m = manifestSchema.parse({ items: [{ ...item, consent: { given: true, by: "c", date: "d" } }] });
    const r = await runBenchmark(m, ".", [sarvam]);
    expect(r).toEqual([{ provider: "sarvam", status: "not_configured", envVar: "SARVAM_API_KEY" }]);
    if (saved) process.env.SARVAM_API_KEY = saved;
  });
});

describe("providers", () => {
  it("unconfigured transcribe throws ProviderNotConfigured", async () => {
    const saved = process.env.SARVAM_API_KEY; delete process.env.SARVAM_API_KEY;
    await expect(sarvam.transcribe("x.wav")).rejects.toBeInstanceOf(ProviderNotConfigured);
    if (saved) process.env.SARVAM_API_KEY = saved;
  });
  it("pickAsr prefers a configured provider and lists status", () => {
    expect(asrStatus().map((s) => s.name)).toEqual(["sarvam", "groq"]);
    expect(() => pickAsr("nope")).toThrow(/unknown/);
  });
  // parser tests use hand-written response SHAPES; they do not prove the live API matches
  it("parsers offset times and refuse text without word timestamps", () => {
    const p = parseSarvam({ transcript: "a b", language_code: "te-IN", timestamps: { words: ["a", "b"], start_time_seconds: [0, 1], end_time_seconds: [1, 2] } }, 25);
    expect(p.words.map((w) => w.start)).toEqual([25, 26]);
    expect(() => parseSarvam({ transcript: "a b" }, 0)).toThrow(/without word timestamps/);
    expect(parseWhisper({ text: "hi", words: [{ word: " hi", start: 0, end: 0.4 }] }).words[0]!.w).toBe("hi");
    expect(() => parseWhisper({ text: "hi" })).toThrow(/without word/);
  });
});

import { smokeChecks } from "../reel/benchmark/smoke";
import { splitAudio } from "../reel/asr/audio";
import { makeSampleVideo, extractAudio } from "../utils/transcode";
import fs from "fs";
import os from "os";
import path from "path";

describe("smoke checks and audio chunking", () => {
  it("flags empty, unordered or out-of-range output and wrong script", () => {
    const ok = smokeChecks({ words: [{ w: "a", start: 0, end: 1 }, { w: "b", start: 1, end: 2 }], text: "namaskaram" }, 2.2, "roman");
    expect(ok.every((c) => c.pass)).toBe(true);
    expect(smokeChecks({ words: [], text: "" }, 2, "native")[0]!.pass).toBe(false);
    expect(smokeChecks({ words: [{ w: "a", start: 5, end: 6 }, { w: "b", start: 1, end: 2 }], text: "x" }, 3, "native").filter((c) => !c.pass).length).toBeGreaterThanOrEqual(2);
    expect(smokeChecks({ words: [{ w: "a", start: 0, end: 1 }], text: "namaskaram" }, 2, "native")[3]!.pass).toBe(false);
  });
  it("splits real audio into <=N second chunks with offsets", async () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "chunk-"));
    await makeSampleVideo(path.join(d, "v.mp4"), "testsrc2", 8);
    await extractAudio(path.join(d, "v.mp4"), path.join(d, "a.mp3"));
    const c = await splitAudio(path.join(d, "a.mp3"), path.join(d, "c"), 3);
    expect(c.map((x) => x.offset)).toEqual([0, 3, 6]);
  }, 30000);
});
