import { describe, it, expect } from "vitest";
import { signStreamToken, verifyStreamToken, signGuestToken, verifyGuestToken, hashToken } from "../utils/reviewTokens";

describe("stream token", () => {
  it("verifies for its version only", () => {
    const t = signStreamToken("v1");
    expect(verifyStreamToken(t, "v1")).toBe(true);
    expect(verifyStreamToken(t, "v2")).toBe(false);
  });
  it("expires", () => {
    const t = signStreamToken("v1", 10, 0);
    expect(verifyStreamToken(t, "v1", 5_000)).toBe(true);
    expect(verifyStreamToken(t, "v1", 11_000)).toBe(false);
  });
  it("rejects tampering and junk", () => {
    const [b, m] = signStreamToken("v1").split(".");
    expect(verifyStreamToken(`${b}x.${m}`, "v1")).toBe(false);
    expect(verifyStreamToken("junk", "v1")).toBe(false);
    expect(verifyStreamToken(undefined, "v1")).toBe(false);
  });
});

describe("guest token", () => {
  it("round-trips and rejects garbage", () => {
    const t = signGuestToken({ pid: "p", lid: "l", name: "Ann" });
    expect(verifyGuestToken(t)?.pid).toBe("p");
    expect(verifyGuestToken(t + "x")).toBeNull();
  });
  it("hash is stable", () => expect(hashToken("a")).toBe(hashToken("a")));
});
