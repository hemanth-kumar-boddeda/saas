// SEC-02 regression tests: authorization depends ONLY on the persisted role
// loaded server-side. Registration can never grant admin; the sole admin-grant
// path is the PLATFORM_ADMIN_EMAIL bootstrap applied after verified login.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const redisMock = await vi.hoisted(async () => {
  const m = await import("./helpers/mockRedis");
  return m.createRedisMock();
});
vi.mock("../utils/redis", () => ({ redis: redisMock.redis }));

const userDb = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
  findByIdAndUpdate: vi.fn(),
}));
const sendMailMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
vi.mock("../models/user.model", () => ({
  default: {
    findOne: userDb.findOne,
    create: userDb.create,
    find: userDb.find,
    findByIdAndUpdate: userDb.findByIdAndUpdate,
  },
}));

vi.mock("../utils/sendMail", () => ({ default: sendMailMock }));
vi.mock("ejs", () => ({
  default: { renderFile: vi.fn().mockResolvedValue("<html></html>") },
}));

import { buildTestApp } from "./helpers/testApp";

const app = buildTestApp();

const signAccess = (id: string) =>
  jwt.sign({ id }, process.env.ACCESS_TOKEN as string, { expiresIn: "15m" });
const signRefresh = (id: string) =>
  jwt.sign({ id }, process.env.REFRESH_TOKEN as string, { expiresIn: "30d" });

const makeUser = (overrides: Record<string, any> = {}) => ({
  _id: "u-1",
  name: "Test",
  email: "user@example.com",
  role: "user",
  isVerified: true,
  save: vi.fn().mockResolvedValue(undefined),
  comparePassword: vi.fn().mockResolvedValue(true),
  signAccessToken: () => signAccess("u-1"),
  signRefreshToken: () => signRefresh("u-1"),
  ...overrides,
});

const cookieHeader = (res: request.Response): string => {
  const cookies: string[] = res.headers["set-cookie"] ?? [];
  return cookies.map((c) => c.split(";")[0]).join("; ");
};

const loginAs = async (user: Record<string, any>) => {
  userDb.findOne.mockReturnValue({
    select: () => Promise.resolve(user),
  });
  const res = await request(app)
    .post("/v1/auth/login")
    .send({ email: user.email, password: "secret123" });
  expect(res.status).toBe(200);
  return cookieHeader(res);
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.PLATFORM_ADMIN_EMAIL;
  userDb.findOne.mockResolvedValue(null);
  userDb.create.mockImplementation(async (doc: any) => ({
    ...doc,
    _id: "u-new",
    role: doc.role ?? "user",
    save: vi.fn().mockResolvedValue(undefined),
    signAccessToken: () => signAccess("u-new"),
    signRefreshToken: () => signRefresh("u-new"),
  }));
  userDb.find.mockReturnValue({
    sort: () => Promise.resolve([]),
  });
  userDb.findByIdAndUpdate.mockResolvedValue({ _id: "u-1", role: "user" });
});

describe("SEC-02 administrator authorization", () => {
  it("sends a usable activation code to the registered email", async () => {
    const res = await request(app).post("/v1/auth/registration").send({
      name: "New User",
      email: "new-user@gmail.com",
      password: "secret123",
    });

    expect(res.status).toBe(201);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new-user@gmail.com",
        template: "activation-mail.ejs",
        data: expect.objectContaining({
          user: { name: "New User" },
          activeCode: expect.stringMatching(/^\d{4}$/),
          ttlMinutes: 5,
        }),
      })
    );
    expect(res.body.activeToken).toBeTruthy();

    const activationEmail = sendMailMock.mock.calls[0][0];
    const activated = await request(app)
      .post("/v1/auth/active-user")
      .send({
        active_token: res.body.activeToken,
        active_code: activationEmail.data.activeCode,
      });

    expect(activated.status).toBe(201);
    expect(userDb.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New User",
        email: "new-user@gmail.com",
        password: "secret123",
      })
    );
  });

  it("loads the logged-in user from the session", async () => {
    const cookies = await loginAs(makeUser());

    const res = await request(app)
      .get("/v1/auth/me")
      .set("Cookie", cookies);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("user@example.com");
  });

  it("rotates refresh tokens and rejects a replayed token", async () => {
    const cookies = await loginAs(makeUser());
    const refreshCookie = cookies
      .split("; ")
      .find((cookie) => cookie.startsWith("refresh_token="));
    expect(refreshCookie).toBeDefined();

    const refreshed = await request(app)
      .get("/v1/auth/refresh-token")
      .set("Cookie", cookies);
    expect(refreshed.status).toBe(200);
    expect(cookieHeader(refreshed)).toContain("refresh_token=");

    const replay = await request(app)
      .get("/v1/auth/refresh-token")
      .set("Cookie", refreshCookie as string);
    expect(replay.status).toBe(401);
  });

  it("does not rotate the refresh token for each protected request", async () => {
    const cookies = await loginAs(makeUser());

    const me = await request(app)
      .get("/v1/auth/me")
      .set("Cookie", cookies);
    expect(me.status).toBe(200);
    expect(me.headers["set-cookie"]).toBeUndefined();

    const refresh = await request(app)
      .get("/v1/auth/refresh-token")
      .set("Cookie", cookies);
    expect(refresh.status).toBe(200);
  });

  it("refreshes an expired access token before loading the user", async () => {
    const cookies = await loginAs(makeUser());
    const refreshCookie = cookies
      .split("; ")
      .find((cookie) => cookie.startsWith("refresh_token="));
    expect(refreshCookie).toBeDefined();
    const refreshToken = (refreshCookie as string).slice("refresh_token=".length);
    const decoded = jwt.decode(refreshToken) as jwt.JwtPayload;
    const expiredAccess = jwt.sign(
      { id: decoded.id, sid: decoded.sid },
      process.env.ACCESS_TOKEN as string,
      { expiresIn: -1 }
    );

    const res = await request(app)
      .get("/v1/auth/me")
      .set("Cookie", `access_token=${expiredAccess}; ${refreshCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("user@example.com");
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("access_token=")])
    );
  });

  it("revokes the login session on logout", async () => {
    const cookies = await loginAs(makeUser());

    const logout = await request(app)
      .get("/v1/auth/logout")
      .set("Cookie", cookies);
    expect(logout.status).toBe(200);

    const me = await request(app)
      .get("/v1/auth/me")
      .set("Cookie", cookies);
    expect(me.status).toBe(401);
  });

  it("registering the platform-admin e-mail does not create an administrator", async () => {
    process.env.PLATFORM_ADMIN_EMAIL = "admin@example.com";

    const reg = await request(app).post("/v1/auth/registration").send({
      name: "Admin",
      email: "admin@example.com",
      password: "secret123",
    });
    expect(reg.status).toBe(201);
    expect(reg.body.activeToken).toBeTruthy();

    const decoded = jwt.verify(
      reg.body.activeToken,
      process.env.ACTIVE_TOKEN_SECRET as string
    ) as any;
    const active = await request(app).post("/v1/auth/active-user").send({
      active_token: reg.body.activeToken,
      active_code: decoded.activeCode,
    });
    expect(active.status).toBe(201);

    const created = userDb.create.mock.calls[0][0];
    expect(created.role).not.toBe("admin");
  });

  it("grants admin ONLY through the approved bootstrap after verified login", async () => {
    process.env.PLATFORM_ADMIN_EMAIL = "admin@example.com";
    const user = makeUser({ email: "admin@example.com" });

    const cookies = await loginAs(user);

    expect(user.role).toBe("admin");
    expect(user.save).toHaveBeenCalled();
    // Session now carries the persisted admin role for downstream guards.
    const res = await request(app)
      .get("/v1/users/get-users")
      .set("Cookie", cookies);
    expect(res.status).toBe(201);
  });

  it("never grants admin when PLATFORM_ADMIN_EMAIL is not configured", async () => {
    const user = makeUser({ email: "anyone@example.com" });

    await loginAs(user);

    expect(user.role).toBe("user");
    expect(user.save).not.toHaveBeenCalled();
  });

  it("rejects a normal user on administrator routes with 403", async () => {
    const cookies = await loginAs(makeUser());

    const getUsers = await request(app)
      .get("/v1/users/get-users")
      .set("Cookie", cookies);
    expect(getUsers.status).toBe(403);

    const updateCookies = await loginAs(makeUser());
    const updateRole = await request(app)
      .put("/v1/users/update-user-role")
      .set("Cookie", updateCookies)
      .send({ id: "u-2", role: "admin" });
    expect(updateRole.status).toBe(403);
    expect(userDb.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated access to administrator routes with 401", async () => {
    const res = await request(app).get("/v1/users/get-users");
    expect(res.status).toBe(401);
  });

  it("cannot bypass authorization with role claims in headers or body", async () => {
    const cookies = await loginAs(makeUser());

    const viaHeader = await request(app)
      .get("/v1/users/get-users")
      .set("Cookie", cookies)
      .set("x-role", "admin")
      .set("role", "admin");
    expect(viaHeader.status).toBe(403);

    const bodyCookies = await loginAs(makeUser());
    const viaBody = await request(app)
      .put("/v1/users/update-user-role")
      .set("Cookie", bodyCookies)
      .send({ id: "u-2", role: "admin", user: { role: "admin" } });
    expect(viaBody.status).toBe(403);
    expect(userDb.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("restricts updateUserRole to a closed set of role values", async () => {
    const admin = makeUser({ role: "admin" });
    const cookies = await loginAs(admin);

    const res = await request(app)
      .put("/v1/users/update-user-role")
      .set("Cookie", cookies)
      .send({ id: "u-2", role: "superadmin" });
    expect(res.status).toBe(400);
    expect(userDb.findByIdAndUpdate).not.toHaveBeenCalled();

    const freshCookies = await loginAs(admin);
    const ok = await request(app)
      .put("/v1/users/update-user-role")
      .set("Cookie", freshCookies)
      .send({ id: "u-2", role: "admin" });
    expect(ok.status).toBe(201);
    expect(userDb.findByIdAndUpdate).toHaveBeenCalledWith(
      "u-2",
      { role: "admin" },
      { new: true }
    );
  });
});
