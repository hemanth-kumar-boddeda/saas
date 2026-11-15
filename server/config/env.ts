// Startup environment validation (SEC-16).
//
// The server refuses to boot when a FATAL variable is missing and prints only
// the variable NAMES — never a value. Optional integrations are reported but
// never block startup; their endpoints fail closed with 503 at call time.
//
// `required` means "the application cannot serve requests without it".
// Integration keys (Stripe, SMTP, Google, VdoCipher, Cloudinary) are optional
// at boot so the app can run in a degraded, mock-friendly local mode.
require("dotenv").config();

export type EnvScope =
  | "core"
  | "database"
  | "auth"
  | "oauth"
  | "email"
  | "payments"
  | "video"
  | "realtime"
  | "admin";

export interface EnvSpec {
  name: string;
  scope: EnvScope;
  /** Fatal: the server refuses to start without it. */
  required: boolean;
  purpose: string;
  provider: string;
}

export const ENV_SPECS: EnvSpec[] = [
  { name: "PORT", scope: "core", required: false, purpose: "TCP port for the API server", provider: "you" },
  { name: "NODE_ENV", scope: "core", required: false, purpose: "Runtime mode (development | test | production)", provider: "you" },
  { name: "CLIENT_ORIGIN", scope: "core", required: false, purpose: "Comma-separated browser origins allowed by CORS", provider: "you" },
  { name: "DB_URL", scope: "database", required: true, purpose: "MongoDB connection string", provider: "MongoDB Atlas / self-hosted" },
  { name: "REDIS_URL", scope: "database", required: true, purpose: "Redis connection string for sessions and caches", provider: "Upstash / self-hosted Redis" },
  { name: "ACCESS_TOKEN", scope: "auth", required: true, purpose: "Signing secret for the short-lived access token", provider: "you" },
  { name: "REFRESH_TOKEN", scope: "auth", required: true, purpose: "Signing secret for the refresh token", provider: "you" },
  { name: "ACCESS_TOKEN_TTL_SECONDS", scope: "auth", required: false, purpose: "Access token lifetime (default 900)", provider: "you" },
  { name: "REFRESH_TOKEN_TTL_SECONDS", scope: "auth", required: false, purpose: "Refresh token + session lifetime (default 2592000)", provider: "you" },
  { name: "ACTIVATION_TOKEN_TTL_SECONDS", scope: "auth", required: false, purpose: "Activation token lifetime (default 900)", provider: "you" },
  { name: "GOOGLE_CLIENT_ID", scope: "oauth", required: false, purpose: "Google OAuth client id for social login", provider: "Google Cloud Console" },
  { name: "GOOGLE_CLIENT_SECRET", scope: "oauth", required: false, purpose: "Google OAuth client secret", provider: "Google Cloud Console" },
  { name: "SMTP_HOST", scope: "email", required: false, purpose: "SMTP server hostname", provider: "your mail provider" },
  { name: "SMTP_PORT", scope: "email", required: false, purpose: "SMTP server port", provider: "your mail provider" },
  { name: "SMTP_SERVICE", scope: "email", required: false, purpose: "Nodemailer well-known service name", provider: "your mail provider" },
  { name: "SMTP_MAIL", scope: "email", required: false, purpose: "SMTP username / sender address", provider: "your mail provider" },
  { name: "SMTP_PASSWORD", scope: "email", required: false, purpose: "SMTP password or app password", provider: "your mail provider" },
  { name: "STORAGE_DIR", scope: "video", required: false, purpose: "Directory for uploaded videos and HLS output (default ./storage)", provider: "you" },
  { name: "MAX_UPLOAD_MB", scope: "video", required: false, purpose: "Max upload size in MB (default 1024)", provider: "you" },
  { name: "STREAM_SECRET", scope: "video", required: false, purpose: "HMAC secret for signed stream URLs (derived from ACCESS_TOKEN if unset)", provider: "you" },
  { name: "GUEST_SECRET", scope: "video", required: false, purpose: "Signing secret for guest review sessions (derived from ACCESS_TOKEN if unset)", provider: "you" },
  { name: "PLATFORM_ADMIN_EMAIL", scope: "admin", required: false, purpose: "E-mail promoted to admin once, after a verified login", provider: "you" },
];

const isPresent = (name: string) => {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
};

export interface EnvValidationResult {
  missingFatal: string[];
  missingOptional: string[];
  /** Configured but suspiciously weak — reported, never printed. */
  weak: string[];
}

/**
 * Validates the environment. Never throws and never prints a value: only
 * variable names and the reason a variable is reported.
 */
export const validateEnv = (): EnvValidationResult => {
  const missingFatal: string[] = [];
  const missingOptional: string[] = [];

  for (const spec of ENV_SPECS) {
    if (isPresent(spec.name)) continue;
    (spec.required ? missingFatal : missingOptional).push(spec.name);
  }

  const weak: string[] = [];
  if (process.env.NODE_ENV === "production") {
    for (const name of ["ACCESS_TOKEN", "REFRESH_TOKEN"]) {
      const value = process.env[name];
      if (value && value.length < 32) weak.push(name);
    }
  }

  return { missingFatal, missingOptional, weak };
};

/** Throws with variable NAMES only when a fatal variable is missing. */
export const assertEnv = (): EnvValidationResult => {
  const result = validateEnv();
  if (result.missingFatal.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${result.missingFatal.join(", ")}. ` +
        `See server/.env.example for the full list.`
    );
  }
  if (result.weak.length > 0) {
    throw new Error(
      `Weak secret(s) in production: ${result.weak.join(", ")} must be at least 32 characters.`
    );
  }
  return result;
};

/** Browser origins allowed by CORS. Defaults to the local Next.js dev server. */
export const allowedOrigins = (): string[] => {
  const raw = process.env.CLIENT_ORIGIN || "http://localhost:3000";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};
