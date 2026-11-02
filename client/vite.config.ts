import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { contentVersion } from "../scripts/content-version.mjs";

const root = resolve(import.meta.dirname, "..");
const version = contentVersion(root);

export default defineConfig({
  base: "./",
  define: { __CONTENT_VERSION__: JSON.stringify(version) },
  server: {
    fs: { allow: [".."] },
    proxy: { "/v1": "http://127.0.0.1:8080" },
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
