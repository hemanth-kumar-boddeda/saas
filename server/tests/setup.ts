// Runs before every test file (vitest setupFiles).
// - Provides deterministic, non-production test configuration.
// - Never contacts MongoDB, Redis, Stripe, Google or SMTP: those are mocked
//   per test file; these values only satisfy module-scope reads.
import { createRequire } from "node:module";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.ACCESS_TOKEN = "test-access-secret-do-not-use-in-prod";
process.env.REFRESH_TOKEN = "test-refresh-secret-do-not-use-in-prod";
process.env.ACTIVE_TOKEN_SECRET = "test-active-secret-do-not-use-in-prod";
process.env.ACCESS_TOKEN_EXPIRE = "15";
process.env.REFRESH_TOKEN_EXPIRE = "30";
process.env.REDIS_URL = "redis://127.0.0.1:6379";
process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_dummy";
process.env.STRIPE_CURRENCY = "inr";
process.env.SMTP_HOST = "localhost";
process.env.SMTP_PORT = "25";
process.env.ORIGIN = "http://localhost:3000";

// Several legacy modules call bare require("dotenv")/require("stripe") at
// module scope. Vitest transforms files to ESM where `require` is not defined,
// so expose a real CJS require on the global object for those call sites.
const require2 = createRequire(process.cwd() + "/package.json");
(globalThis as unknown as { require: NodeRequire }).require = require2;
