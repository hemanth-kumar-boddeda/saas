import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { askJson, transcribe } from "../utils/ai";

const schema = z.object({ n: z.number() });
const fake = (...replies: string[]) => {
  const create = vi.fn();
  replies.forEach((t) => create.mockResolvedValueOnce({ content: [{ type: "text", text: t }] }));
  return { client: { messages: { create } } as any, create };
};
const o = { model: "claude-haiku-5-5", system: "sys", user: "go" };

describe("askJson", () => {
  it("returns validated data on first try", async () => {
    const { client, create } = fake('{"n":1}');
    expect(await askJson(schema, o, client)).toEqual({ n: 1 });
    expect(create.mock.calls[0][0].system).toMatch(/JSON object only/);
  });
  it("retries with the validation error fed back", async () => {
    const { client, create } = fake("sorry", '```json\n{"n":"x"}\n```', '{"n":3}');
    expect(await askJson(schema, o, client)).toEqual({ n: 3 });
    expect(create).toHaveBeenCalledTimes(3);
    const last = create.mock.calls[2][0].messages;
    expect(last.at(-1).content).toMatch(/invalid.*n:/);
    expect(last.at(-2).role).toBe("assistant");
  });
  it("gives up with 502 after the attempt limit", async () => {
    const { client, create } = fake("a", "b");
    await expect(askJson(schema, { ...o, attempts: 2 }, client)).rejects.toMatchObject({ statusCode: 502 });
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("sends images as indexed base64 jpeg blocks", async () => {
    const { client, create } = fake('{"n":1}');
    await askJson(schema, { ...o, images: [Buffer.from("x")] }, client);
    const c = create.mock.calls[0][0].messages[0].content;
    expect(c[0].text).toBe("Frame 0:");
    expect(c[1].source).toMatchObject({ type: "base64", media_type: "image/jpeg" });
  });
  it("503 without an API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(askJson(schema, o)).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("transcribe", () => {
  it("503 without an OpenAI key", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(transcribe("/nope.mp3")).rejects.toMatchObject({ statusCode: 503 });
  });
});
