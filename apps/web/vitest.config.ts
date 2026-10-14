import { defineConfig } from "vitest/config";
import path from "node:path";

const testDb = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/sukkot_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws outside React Server Components; tests run services directly.
      "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    env: {
      DATABASE_URL: testDb,
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      STORAGE_DRIVER: "local",
      STORAGE_LOCAL_DIR: path.resolve(__dirname, ".test-storage"),
      EMAIL_DRIVER: "console",
      PAYMENT_METHODS_ENABLED: "SANDBOX,BANK_TRANSFER,CASH,MANUAL",
      SANDBOX_WEBHOOK_SECRET: "test-sandbox-secret",
    },
    // Integration tests share one database; run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
