// SEC-01 / SEC-06 — activation credential.
//
// The activation credential is 32 random bytes rendered as hex. Only its
// SHA-256 hash is stored on the user row; the raw value exists solely in the
// activation e-mail. It is single-use (the hash is cleared on success) and
// expiring.
//
// Nothing is signed here: a JWT would add a second artifact without adding a
// property the random token does not already have (unguessable, revocable,
// single-use, expiring) — and it would put user fields inside a token, which
// is exactly the SEC-01 defect.
import crypto from "crypto";
import { AUTH } from "../config/auth";

export const generateActivationToken = (): string =>
  crypto.randomBytes(32).toString("hex");

export const hashActivationToken = (token: string): string =>
  crypto.createHash("sha256").update(token.trim()).digest("hex");

export const activationTokenExpiry = (): Date =>
  new Date(Date.now() + AUTH.activationTtlSeconds * 1000);

export const isActivationExpired = (expiresAt: Date | undefined | null): boolean =>
  !expiresAt || expiresAt.getTime() <= Date.now();
