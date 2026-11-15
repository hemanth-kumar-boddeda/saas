// SEC-03 / Finding B — the SINGLE source of truth for every auth lifetime.
// Nothing else in the codebase may define a token, cookie or session TTL.
// Every value is expressed in SECONDS with an explicit unit in the name.
//
// Normative source: docs/architecture/SECURITY_AND_THREAT_MODEL.md §4.2
//   access token  <= 15 min   (AUTH.accessTtlSeconds)
//   refresh token <= 30 days  (AUTH.refreshTtlSeconds)
//   session TTL   == refresh TTL, on EVERY write path
require("dotenv").config();

const intFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const AUTH = {
  // Access token: short-lived. Read from ACCESS_TOKEN_TTL_SECONDS.
  accessTtlSeconds: intFromEnv("ACCESS_TOKEN_TTL_SECONDS", 15 * 60),
  // Refresh token: rotated on use. Read from REFRESH_TOKEN_TTL_SECONDS.
  refreshTtlSeconds: intFromEnv("REFRESH_TOKEN_TTL_SECONDS", 30 * 24 * 60 * 60),
  // Activation credential lifetime (SEC-06): single-use, expiring.
  activationTtlSeconds: intFromEnv("ACTIVATION_TOKEN_TTL_SECONDS", 15 * 60),
} as const;

// Cookie maxAge (ms) derived from the same constants — never a second literal.
export const accessCookieMaxAgeMs = AUTH.accessTtlSeconds * 1000;
export const refreshCookieMaxAgeMs = AUTH.refreshTtlSeconds * 1000;

// Redis session TTL (seconds) == refresh TTL, per the normative table.
export const sessionTtlSeconds = AUTH.refreshTtlSeconds;
