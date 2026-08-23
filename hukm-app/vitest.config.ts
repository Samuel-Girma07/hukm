import { defineConfig } from "vitest/config";
import path from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    // The nvidia timeout suite uses real HTTP + timers; parallel worker
    // threads on Windows starve it and stall the run. Sequential is
    // ~80s total and deterministic.
    fileParallelism: false,
  },
});
