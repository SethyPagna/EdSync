import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const TEST_FILE = "{test,spec}.{ts,tsx}";

export default defineConfig({
  test: {
    // Keep DOM worker startup reliable on local machines and small CI runners.
    maxWorkers: 2,
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["node_modules", ".next", ".open-next"],
    projects: [
      {
        // Pure library code runs without a DOM: faster startup and no browser globals leaking into server logic.
        // A lib test that needs the DOM can opt in with a `// @vitest-environment jsdom` docblock.
        extends: true,
        test: {
          name: "lib",
          environment: "node",
          include: ["src/lib/**/*.{test,spec}.ts"],
          exclude: ["src/lib/ui/**"],
        },
      },
      {
        // Components, routes, proxy, browser-facing lib code (src/lib/ui) and any .tsx test.
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [`src/*.${TEST_FILE}`, `src/!(lib)/**/*.${TEST_FILE}`, `src/lib/ui/**/*.${TEST_FILE}`, "src/lib/**/*.{test,spec}.tsx"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../src", import.meta.url)),
    },
  },
});
