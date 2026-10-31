#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, "..", "dist");

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

const totalBytes = getDirectorySizeBytes(distDir);
const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);

console.log(`dist size: ${totalMb} MB (limit: 10.00 MB)`);

if (totalBytes > MAX_BYTES) {
  console.error(`Bundle size limit exceeded: ${totalMb} MB > 10.00 MB`);
  process.exit(1);
}
