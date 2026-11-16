// SEC-01 / API_CONTRACT §1.6 — rate limits for the authentication class.
//
//   Auth (login, registration, activation, reset): 10/min/IP + 5/15min per account
//
// Limits are applied per authentication endpoint (one bucket each) so a burst
// against one endpoint can never be used to exhaust another one, and so a
// successful login does not consume the per-account budget.
import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { Request, Response } from "express";
import crypto from "crypto";

const WINDOW_PER_MINUTE_MS = 60 * 1000;
const WINDOW_PER_ACCOUNT_MS = 15 * 60 * 1000;

const PER_IP_LIMIT = 10;
const PER_ACCOUNT_LIMIT = 5;

const limitHandler = (req: Request, res: Response) => {
  res.status(429).json({
    success: false,
    code: "RATE_LIMITED",
    message: "Too many attempts. Please try again later.",
  });
};

const base = {
  windowMs: WINDOW_PER_MINUTE_MS,
  limit: PER_IP_LIMIT,
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  handler: limitHandler,
};

// 10/min/IP for every authentication endpoint.
export const authIpLimiter: RateLimitRequestHandler = rateLimit(base);

// 5/15min per account (failed attempts only) for endpoints that know the
// account: login and registration.
export const authAccountLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: WINDOW_PER_ACCOUNT_MS,
  limit: PER_ACCOUNT_LIMIT,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: limitHandler,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    return `acct:${email.trim().toLowerCase()}`;
  },
});

// Activation links are opaque, so the "account" is the presented token.
// Only the hash is used as the bucket key.
export const activationTokenLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: WINDOW_PER_ACCOUNT_MS,
  limit: PER_ACCOUNT_LIMIT,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: limitHandler,
  keyGenerator: (req: Request) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    return `act:${hash}`;
  },
});

// AI endpoints cost money: 5 kit generations/hour per signed-in user.
// Mount after requireUser/projectAccess so req.user is set.
export const aiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: limitHandler,
  keyGenerator: (req: Request) => `ai:${String(req.user?._id ?? "anon")}`,
});

// Publishing hits external APIs and quotas: 10/hour per signed-in user.
export const publishLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: limitHandler,
  keyGenerator: (req: Request) => `pub:${String(req.user?._id ?? "anon")}`,
});
