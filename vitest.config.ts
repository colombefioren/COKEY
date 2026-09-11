import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Native SQLite handles keep the process alive briefly after teardown.
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
