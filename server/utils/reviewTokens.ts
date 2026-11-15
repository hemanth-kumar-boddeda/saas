// Signed, expiring tokens for streaming URLs and guest sessions.
import crypto from "crypto";
import jwt from "jsonwebtoken";

const secret = (purpose: string) =>
  process.env[`${purpose}_SECRET`] ||
  crypto.createHash("sha256").update(`${process.env.ACCESS_TOKEN}:${purpose}`).digest("hex");

const b64 = (s: string) => Buffer.from(s).toString("base64url");

/** Opaque HMAC token granting read access to one version's HLS files. */
export const signStreamToken = (versionId: string, ttlSeconds = 3600, now = Date.now()) => {
  const body = b64(JSON.stringify({ v: versionId, e: Math.floor(now / 1000) + ttlSeconds }));
  const mac = crypto.createHmac("sha256", secret("STREAM")).update(body).digest("base64url");
  return `${body}.${mac}`;
};

export const verifyStreamToken = (token: unknown, versionId: string, now = Date.now()): boolean => {
  if (typeof token !== "string") return false;
  const [body, mac] = token.split(".");
  if (!body || !mac) return false;
  const expected = crypto.createHmac("sha256", secret("STREAM")).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { v, e } = JSON.parse(Buffer.from(body, "base64url").toString());
    return v === versionId && typeof e === "number" && e > now / 1000;
  } catch {
    return false;
  }
};

export interface GuestClaims {
  pid: string;
  lid: string;
  name: string;
}

export const signGuestToken = (claims: GuestClaims, expiresAt?: Date | null) => {
  const maxSeconds = 12 * 3600;
  const untilExpiry = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 1000) : maxSeconds;
  return jwt.sign(claims, secret("GUEST"), { expiresIn: Math.max(1, Math.min(maxSeconds, untilExpiry)) });
};

export const verifyGuestToken = (token: string): GuestClaims | null => {
  try {
    const c = jwt.verify(token, secret("GUEST")) as GuestClaims;
    return c?.pid && c?.lid ? c : null;
  } catch {
    return null;
  }
};

export const hashToken = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");
export const newLinkToken = () => crypto.randomBytes(32).toString("base64url");
