import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  server: {
    fs: { allow: [".."] },
    port: 5173,
    strictPort: false,
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
