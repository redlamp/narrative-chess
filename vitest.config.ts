import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["apps/**/*.test.ts?(x)", "packages/**/*.test.ts?(x)"]
  }
});
