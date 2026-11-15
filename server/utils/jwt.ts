// SEC-03 / SEC-04 / Finding B — token minting and cookie handling.
//
// Every lifetime comes from `server/config/auth.ts` (the single source of
// truth). The JWT `exp` and the cookie `maxAge` are derived from the SAME
// constant, so they can never drift apart (B-2).
//
// Tokens are NEVER returned in a response body: they live only in HttpOnly
// cookies. Response bodies carry a safe user projection (SEC-04).
require("dotenv").config();
import { Response } from "express";
import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { AUTH, accessCookieMaxAgeMs, refreshCookieMaxAgeMs } from "../config/auth";
import { createSession } from "./session";
import { toSafeUser } from "./safeUser";

interface ICookieOptions {
  expires: Date;
  maxAge: number;
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  path: string;
}

const isProduction = process.env.NODE_ENV === "production";

const buildCookieOptions = (maxAgeMs: number, httpOnly = true): ICookieOptions => ({
  expires: new Date(Date.now() + maxAgeMs),
  maxAge: maxAgeMs,
  httpOnly,
  sameSite: "lax",
  // Secure in production; also required for SameSite=None deployments.
  secure: isProduction,
  path: "/",
});

export const accessTokenOptions: ICookieOptions = buildCookieOptions(accessCookieMaxAgeMs);
export const refreshTokenOptions: ICookieOptions = buildCookieOptions(refreshCookieMaxAgeMs);
// The CSRF cookie is deliberately readable by the browser: it is the
// double-submit half of the CSRF defence, never a credential.
export const csrfCookieOptions: ICookieOptions = buildCookieOptions(refreshCookieMaxAgeMs, false);

export const CSRF_COOKIE = "cf_csrf";
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

/** Identifier of one refresh token, used to detect replay after rotation. */
export const newTokenId = () => crypto.randomBytes(16).toString("hex");

// JWT payloads carry the session id (`sid`) so the server can revoke them.
export const signAccessToken = (userId: string, sessionId: string): string =>
  jwt.sign({ id: userId, sid: sessionId }, process.env.ACCESS_TOKEN as string, {
    expiresIn: AUTH.accessTtlSeconds,
  } as SignOptions);

export const signRefreshToken = (
  userId: string,
  sessionId: string,
  tokenId: string
): string =>
  jwt.sign({ id: userId, sid: sessionId, jti: tokenId }, process.env.REFRESH_TOKEN as string, {
    expiresIn: AUTH.refreshTtlSeconds,
  } as SignOptions);

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, process.env.ACCESS_TOKEN as string);

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, process.env.REFRESH_TOKEN as string);

/**
 * Creates a fresh session and sets the auth cookies.
 * The response body carries NO access/refresh token (SEC-03, B-6).
 */
export const sendToken = async (user: any, statusCode: number, res: Response) => {
  const userId = String(user._id);
  const tokenId = newTokenId();
  const sessionId = await createSession(user, tokenId);

  const accessToken = signAccessToken(userId, sessionId);
  const refreshToken = signRefreshToken(userId, sessionId, tokenId);

  res.cookie(ACCESS_COOKIE, accessToken, accessTokenOptions);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshTokenOptions);
  res.cookie(CSRF_COOKIE, crypto.randomBytes(16).toString("hex"), csrfCookieOptions);

  res.status(statusCode).json({
    success: true,
    user: toSafeUser(user),
  });
};

/** Removes the auth cookies. The options must match the ones used to set them. */
export const clearAuthCookies = (res: Response) => {
  res.clearCookie(ACCESS_COOKIE, { ...accessTokenOptions, maxAge: undefined, expires: undefined });
  res.clearCookie(REFRESH_COOKIE, { ...refreshTokenOptions, maxAge: undefined, expires: undefined });
  res.clearCookie(CSRF_COOKIE, { ...csrfCookieOptions, maxAge: undefined, expires: undefined });
};
