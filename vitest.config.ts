import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
          globalSetup: ["server/__tests__/global-setup.ts"],
          // Integration tests share one database; run files sequentially.
          fileParallelism: false,
        },
      },
    ],
  },
});
