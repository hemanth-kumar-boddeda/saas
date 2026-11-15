import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Tests must never reach a real MongoDB/Redis/Stripe/SMTP:
    // every external dependency is mocked per test file (see tests/helpers).
    hookTimeout: 15000,
    testTimeout: 15000,
  },
});
