// SEC-01 regression tests: social authentication must never trust a browser-
// supplied identity. Identity comes only from a provider-verified Google ID
// token (signature, issuer, audience, expiry, subject checked server-side).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

const redisMock = await vi.hoisted(async () => {
  const m = await import("./helpers/mockRedis");
  return m.createRedisMock();
});
vi.mock("../utils/redis", () => ({ redis: redisMock.redis }));

const googleMock = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
}));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    constructor(_clientId: string) {}
    verifyIdToken = googleMock.verifyIdToken;
  },
}));

const userDb = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
}));
vi.mock("../models/user.model", () => ({
  default: {
    findOne: userDb.findOne,
    create: userDb.create,
  },
}));

vi.mock("../utils/sendMail", () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock("ejs", () => ({ default: { renderFile: vi.fn().mockResolvedValue("<html></html>") } }));

import { buildTestApp } from "./helpers/testApp";

const app = buildTestApp();

const validPayload = {
  sub: "google-sub-123",
  email: "alice@example.com",
  email_verified: true,
  name: "Alice",
  picture: "https://example.com/a.png",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
  userDb.findOne.mockResolvedValue(null);
  userDb.create.mockImplementation(async (doc: any) => ({
    ...doc,
    _id: "u-1",
    role: doc.role ?? "user",
    save: vi.fn().mockResolvedValue(undefined),
    signAccessToken: () => "signed-access",
    signRefreshToken: () => "signed-refresh",
  }));
  googleMock.verifyIdToken.mockResolvedValue({ getPayload: () => validPayload });
});

afterEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
});

describe("SEC-01 social authentication", () => {
  it("rejects a forged browser-supplied identity (no idToken) with 401", async () => {
    const res = await request(app)
      .post("/v1/auth/social-auth")
      .send({ email: "victim@example.com", name: "Victim", avatar: "" });
    expect(res.status).toBe(401);
    expect(userDb.create).not.toHaveBeenCalled();
    expect(userDb.findOne).not.toHaveBeenCalled();
  });

  it("rejects an invalid provider token with 401", async () => {
    googleMock.verifyIdToken.mockRejectedValue(new Error("bad token"));
    const res = await request(app)
      .post("/v1/auth/social-auth")
      .send({ idToken: "forged.jwt.value" });
    expect(res.status).toBe(401);
    expect(userDb.create).not.toHaveBeenCalled();
  });

  it("rejects an expired provider token with 401", async () => {
    googleMock.verifyIdToken.mockRejectedValue(
      new Error("Token expired at ...")
    );
    const res = await request(app)
      .post("/v1/auth/social-auth")
      .send({ idToken: "expired.jwt.value" });
    expect(res.status).toBe(401);
  });

  it("fails closed with 503 when Google credentials are not configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const res = await request(app)
      .post("/v1/auth/social-auth")
      .send({ idToken: "any.jwt.value" });
    expect(res.status).toBe(503);
    expect(googleMock.verifyIdToken).not.toHaveBeenCalled();
  });

  it("rejects an unverified provider e-mail with 403", async () => {
    googleMock.verifyIdToken.mockResolvedValue({
      getPayload: () => ({ ...validPayload, email_verified: false }),
    });
    const res = await request(app)
      .post("/v1/auth/social-auth")
      .send({ idToken: "valid.jwt.value" });
    expect(res.status).toBe(403);
    expect(userDb.create).not.toHaveBeenCalled();
  });

  it("resolves a verified identity to the correct account (by provider subject)", async () => {
    const existing = {
      _id: "u-9",
      email: "alice@example.com",
      role: "user",
      signAccessToken: () => "signed-access",
      signRefreshToken: () => "signed-refresh",
    };
    userDb.findOne.mockImplementation(async (query: any) =>
      query.googleId === "google-sub-123" ? existing : null
    );
    const res = await request(app)
      .post("/v1/auth/social-auth")
      .send({ idToken: "valid.jwt.value" });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("alice@example.com");
    expect(userDb.create).not.toHaveBeenCalled();
  });

  it("ignores any role/privilege claim supplied in the request body", async () => {
    const res = await request(app)
      .post("/v1/auth/social-auth")
      .send({ idToken: "valid.jwt.value", role: "admin", is_platform_admin: true });
    expect(res.status).toBe(200);
    const created = userDb.create.mock.calls[0]?.[0];
    expect(created.role).not.toBe("admin");
    expect(res.body.user.role).toBe("user");
  });

  it("links a verified e-mail to an existing account without a provider id", async () => {
    const existing: any = {
      _id: "u-5",
      email: "alice@example.com",
      role: "user",
      save: vi.fn().mockResolvedValue(undefined),
      signAccessToken: () => "signed-access",
      signRefreshToken: () => "signed-refresh",
    };
    userDb.findOne.mockImplementation(async (query: any) => {
      if (query.googleId) return null;
      if (query.email) return existing;
      return null;
    });
    const res = await request(app)
      .post("/v1/auth/social-auth")
      .send({ idToken: "valid.jwt.value" });
    expect(res.status).toBe(200);
    expect(existing.googleId).toBe("google-sub-123");
    expect(existing.save).toHaveBeenCalled();
  });

  it("refuses to take over an account already linked to a different provider subject", async () => {
    const existing: any = {
      _id: "u-6",
      email: "alice@example.com",
      googleId: "someone-else-sub",
      role: "user",
      save: vi.fn(),
    };
    userDb.findOne.mockImplementation(async (query: any) =>
      query.email ? existing : null
    );
    const res = await request(app)
      .post("/v1/auth/social-auth")
      .send({ idToken: "valid.jwt.value" });
    expect(res.status).toBe(403);
    expect(existing.save).not.toHaveBeenCalled();
  });

  it("verifies audience against the configured Google client id", async () => {
    await request(app)
      .post("/v1/auth/social-auth")
      .send({ idToken: "valid.jwt.value" });
    expect(googleMock.verifyIdToken).toHaveBeenCalledWith({
      idToken: "valid.jwt.value",
      audience: "test-client-id.apps.googleusercontent.com",
    });
  });
});
