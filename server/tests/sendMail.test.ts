import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => ({ sendMail: vi.fn().mockResolvedValue({}) })) } }));
import sendMail, { mailTransport } from "../utils/sendMail";

const opts = { email: "a@b.com", subject: "Hi", template: "review-event.ejs", data: { heading: "H", body: "B", project: "P", link: "http://x" } };
const keep = { ...process.env };
afterEach(() => { process.env = { ...keep }; vi.unstubAllGlobals(); });

describe("mailTransport", () => {
  it("resend wins, then smtp, then none", () => {
    expect(mailTransport({ RESEND_API_KEY: "k", SMTP_HOST: "h" })).toBe("resend");
    expect(mailTransport({ SMTP_HOST: "h" })).toBe("smtp");
    expect(mailTransport({ SMTP_SERVICE: "gmail" })).toBe("smtp");
    expect(mailTransport({})).toBeNull();
  });
});

describe("sendMail", () => {
  it("posts to Resend with the rendered html", async () => {
    process.env.RESEND_API_KEY = "re_test"; delete process.env.SMTP_HOST; delete process.env.SMTP_SERVICE;
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", f);
    await sendMail(opts);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ to: ["a@b.com"], subject: "Hi" });
    expect(body.html).toContain("http://x");
  });
  it("surfaces a clear error when Resend rejects", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ message: "domain not verified" }) }));
    await expect(sendMail(opts)).rejects.toThrow(/403.*domain not verified/);
  });
  it("prints instead of failing in dev with no config; fails in production", async () => {
    delete process.env.RESEND_API_KEY; delete process.env.SMTP_HOST; delete process.env.SMTP_SERVICE;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    process.env.NODE_ENV = "development";
    await expect(sendMail(opts)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    process.env.NODE_ENV = "production";
    await expect(sendMail(opts)).rejects.toThrow(/not configured/);
    log.mockRestore();
  });
});
