import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    css: true,
    globals: true,
    testTimeout: 10000,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/mocks/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@legalir/types": path.resolve(__dirname, "../../packages/types/src"),
      "@legalir/config": path.resolve(__dirname, "../../packages/config/src"),
      "@legalir/validation": path.resolve(__dirname, "../../packages/validation/src"),
      "@legalir/api-client": path.resolve(__dirname, "../../packages/api-client/src"),
      "@legalir/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@legalir/i18n": path.resolve(__dirname, "../../packages/i18n/src"),
      "@legalir/testing": path.resolve(__dirname, "../../packages/testing/src"),
    },
  },
});
