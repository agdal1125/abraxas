#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CINEMATIC_BYTES = 13 * 1024 * 1024; // 13 MB, the opening film is fetched only when a new run starts
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, "..", "dist");
const cinematicDir = path.join(distDir, "cinematics");

function getDirectorySizeBytes(dirPath) {
  let total = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirectorySizeBytes(fullPath);
    } else if (entry.isFile()) {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

if (!fs.existsSync(distDir)) {
  console.error("dist directory not found. Run 'npm --prefix client run build' first.");
  process.exit(1);
}

const cinematicBytes = fs.existsSync(cinematicDir) ? getDirectorySizeBytes(cinematicDir) : 0;
const totalBytes = getDirectorySizeBytes(distDir) - cinematicBytes;
const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
const cinematicMb = (cinematicBytes / (1024 * 1024)).toFixed(2);

console.log(`dist size: ${totalMb} MB (limit: 10.00 MB)`);
console.log(`cinematics size: ${cinematicMb} MB (limit: 13.00 MB)`);

if (cinematicBytes > MAX_CINEMATIC_BYTES) {
  console.error(`Cinematic size limit exceeded: ${cinematicMb} MB > 13.00 MB`);
  process.exit(1);
}

if (totalBytes > MAX_BYTES) {
  console.error(`Bundle size limit exceeded: ${totalMb} MB > 10.00 MB`);
  process.exit(1);
}
