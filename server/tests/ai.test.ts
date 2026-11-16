import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import sharp from "sharp";
import fs from "fs";
import os from "os";
import path from "path";
import { askJson, transcribe, rankFramesLocal } from "../utils/ai";

const schema = z.object({ n: z.number() });
const fake = (...replies: string[]) => {
  const complete = vi.fn();
  replies.forEach((t) => complete.mockResolvedValueOnce(t));
  return complete;
};
const o = { tier: "fast" as const, system: "sys", user: "go" };

describe("askJson", () => {
  it("returns validated data on first try", async () => {
    const complete = fake('{"n":1}');
    expect(await askJson(schema, o, complete)).toEqual({ n: 1 });
    expect(complete.mock.calls[0][0].system).toMatch(/JSON object only/);
  });
  it("retries with the validation error fed back", async () => {
    const complete = fake("sorry", '```json\n{"n":"x"}\n```', '{"n":3}');
    expect(await askJson(schema, o, complete)).toEqual({ n: 3 });
    expect(complete).toHaveBeenCalledTimes(3);
    const turns = complete.mock.calls[2][0].turns;
    expect(turns.at(-1).text).toMatch(/invalid.*n:/);
    expect(turns.at(-2).role).toBe("assistant");
  });
  it("gives up with 502 after the attempt limit", async () => {
    const complete = fake("a", "b");
    await expect(askJson(schema, { ...o, attempts: 2 }, complete)).rejects.toMatchObject({ statusCode: 502 });
    expect(complete).toHaveBeenCalledTimes(2);
  });
  it("passes images and audio through to the provider", async () => {
    const complete = fake('{"n":1}');
    await askJson(schema, { ...o, images: [Buffer.from("x")], audio: Buffer.from("a") }, complete);
    expect(complete.mock.calls[0][0].images).toHaveLength(1);
    expect(complete.mock.calls[0][0].audio).toBeInstanceOf(Buffer);
  });
  it("503 with a helpful message when no provider is configured", async () => {
    for (const k of ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "AI_PROVIDER"]) delete process.env[k];
    await expect(askJson(schema, o)).rejects.toMatchObject({ statusCode: 503, message: expect.stringContaining("GEMINI_API_KEY") });
  });
});

describe("transcribe", () => {
  it("503 without any transcription key", async () => {
    for (const k of ["GROQ_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"]) delete process.env[k];
    await expect(transcribe("/nope.mp3")).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("rankFramesLocal", () => {
  it("scores a crisp contrasty frame above a blurry flat one", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frames-"));
    const crisp = path.join(dir, "crisp.jpg");
    const blurry = path.join(dir, "blurry.jpg");
    const stripes = Buffer.alloc(320 * 180);
    for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) stripes[y * 320 + x] = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 230 : 25;
    await sharp(stripes, { raw: { width: 320, height: 180, channels: 1 } }).jpeg().toFile(crisp);
    await sharp(stripes, { raw: { width: 320, height: 180, channels: 1 } }).blur(14).jpeg().toFile(blurry);
    const [a, b] = await rankFramesLocal([crisp, blurry]);
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.index).toBe(0);
  });
});
