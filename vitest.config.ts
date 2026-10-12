import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    // Integration tests share one Postgres database; run files one at a time.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["server/engine/**/*.ts"],
      exclude: ["server/engine/__tests__/**", "server/engine/types.ts"],
      // PRD §37.1: the calculation engine must be fully covered.
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
          globalSetup: ["server/__tests__/global-setup.ts"],
        },
      },
    ],
  },
});
