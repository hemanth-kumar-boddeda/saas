import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.REDIS_URL) {
  throw new Error("❌ Redis connection failed: REDIS_URL not set");
}

// Upstash requires TLS + retry tweaks
export const redis = new Redis(process.env.REDIS_URL, {
  tls: {}, // enforce TLS
  maxRetriesPerRequest: 1, // prevent retry storms
  enableReadyCheck: false, // skip cluster readiness check
  reconnectOnError: () => true, // auto-reconnect
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err));
