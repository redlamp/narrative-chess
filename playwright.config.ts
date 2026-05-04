import { defineConfig } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Mirror Next.js: load .env.local first, then .env (CI sets vars directly).
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const usingLocalServer = BASE_URL === "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: usingLocalServer
    ? {
        // Use bash -c so we can silently skip startup when port 3000 is already
        // claimed by an existing dev server (prevents "exit code 1" on the port
        // conflict that breaks reuseExistingServer detection).
        command:
          "bash -c 'curl -sf http://localhost:3000 > /dev/null 2>&1 && echo \"reusing existing server\" || bun run dev'",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      }
    : undefined,
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
