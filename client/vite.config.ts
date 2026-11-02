import { defineConfig } from "vitest/config";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const paths = ["content/scoring/items.json", "content/scoring/npcs.json", "content/scoring/rules.json", "content/quests/moka-errand.json"];
for (const lang of ["ko", "en"]) for (const [dir, ext] of [["i18n", ".json"], ["ink", ".ink"]]) {
  const prefix = `content/${dir}/${lang}`;
  paths.push(...readdirSync(resolve(root, prefix)).filter(name => name.endsWith(ext!)).map(name => `${prefix}/${name}`));
}
const digest = createHash("sha256");
for (const path of paths.sort()) digest.update(`${path}\0${createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex")}\n`);
const version = `sha256:${digest.digest("hex")}`;

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
