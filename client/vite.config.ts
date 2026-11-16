import { defineConfig } from "vitest/config";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { contentVersion } from "../scripts/content-version.mjs";

const root = resolve(import.meta.dirname, "..");
const version = contentVersion(root);

// Hash of every model and texture the game loads at run time. It is appended to their URLs so they can be cached for a long time.
function assetVersion(dir: string): string {
  const digest = createHash("sha256");
  const files = readdirSync(dir, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
    .map(entry => { const file = join(entry.parentPath, entry.name); return { file, name: file.slice(dir.length).replaceAll("\\", "/") }; })
    .sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  for (const { file, name } of files) digest.update(name).update(readFileSync(file));
  return digest.digest("hex").slice(0, 10);
}

// three.js ships default Draco decoder URLs (new URL(..., import.meta.url)) that Vite copies into dist as five files.
// village.ts always calls setDecoderPath() with the decoders in public/, so those copies are never requested.
const dropUnusedDracoCopies = {
  name: "abraxas-drop-unused-draco-copies",
  apply: "build" as const,
  generateBundle(_: unknown, bundle: Record<string, unknown>) {
    for (const name of Object.keys(bundle)) if (/^assets\/draco_(decoder|wasm_wrapper)-/.test(name)) delete bundle[name];
  },
};

export default defineConfig({
  base: "./",
  plugins: [dropUnusedDracoCopies],
  define: {
    __CONTENT_VERSION__: JSON.stringify(version),
    __ASSET_VERSION__: JSON.stringify(assetVersion(resolve(import.meta.dirname, "public/assets/abraxas"))),
  },
  server: {
    fs: { allow: [".."] },
    proxy: { "/v1": process.env.ABRAXAS_API_ORIGIN || "http://127.0.0.1:8080" },
    port: 5173,
    strictPort: false,
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    // three.js gets its own chunk: it changes rarely, so a game update does not make players download it again.
    chunkSizeWarningLimit: 750,
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: "three", test: /[\\/]node_modules[\\/]three[\\/]/ }] } } },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
