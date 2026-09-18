import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test-setup.ts"],
    // Auth/profile tests hit a real Postgres db; run them one at a time so
    // they don't race each other's table resets.
    fileParallelism: false,
  },
});
