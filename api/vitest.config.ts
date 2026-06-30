import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@env": "./source/env.ts",
      "@shared": "./source/shared",
      "@context": "./source/context",
    },
  },
  test: {
    include: ["testing/**/*.test.ts"],
  },
});
