import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "jsdom",
    // Keep DOM worker startup reliable on local machines and small CI runners.
    maxWorkers: 2,
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", ".open-next"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../src", import.meta.url)),
    },
  },
});
