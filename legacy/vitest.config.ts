import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Default environment is node. Component tests opt into jsdom via
    // a per-file `/** @vitest-environment jsdom */` directive.
    environment: "node",
    // Playwright owns the e2e/ directory; vitest must ignore it.
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
