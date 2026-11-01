#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(client, "..");
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const manifest = json("content/assets/manifest.json").assets;
const map = json("content/world/village.json");
const metadata = { ...json("assets/source/characters/asset-metadata.json").assets, ...json("assets/source/environment/asset-metadata.json").assets };

function parseGlb(data, clips = []) {
  assert(data.length >= 20 && data.readUInt32LE(0) === 0x46546c67 && data.readUInt32LE(4) === 2 && data.readUInt32LE(8) === data.length, "invalid GLB header");
  const jsonLength = data.readUInt32LE(12);
  assert(data.readUInt32LE(16) === 0x4e4f534a && jsonLength % 4 === 0 && 20 + jsonLength + 8 <= data.length, "invalid JSON chunk");
  const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8"));
  const binOffset = 20 + jsonLength, binLength = data.readUInt32LE(binOffset);
  assert(data.readUInt32LE(binOffset + 4) === 0x004e4942 && binOffset + 8 + binLength === data.length, "invalid binary chunk");
  assert(gltf.asset?.version === "2.0" && gltf.buffers?.length === 1 && gltf.buffers[0].byteLength <= binLength, "invalid glTF buffer");
  for (const clip of clips) assert(gltf.animations?.some(animation => animation.name === clip), `missing clip ${clip}`);
  return { gltf, bin: data.subarray(binOffset + 8) };
}

assert.throws(() => parseGlb(Buffer.alloc(20)), /invalid GLB header/);
const sample = Buffer.from(JSON.stringify({ asset: { version: "2.0" }, buffers: [{ byteLength: 0 }] }).padEnd(64));
const fixture = Buffer.alloc(20 + sample.length + 8);
fixture.writeUInt32LE(0x46546c67, 0); fixture.writeUInt32LE(2, 4); fixture.writeUInt32LE(fixture.length, 8);
fixture.writeUInt32LE(sample.length, 12); fixture.writeUInt32LE(0x4e4f534a, 16); sample.copy(fixture, 20);
fixture.writeUInt32LE(0x004e4942, 24 + sample.length);
assert.throws(() => parseGlb(fixture, ["walk"]), /missing clip walk/);

const context = { module: { exports: {} }, exports: {}, console, WebAssembly, TextDecoder, TextEncoder };
vm.runInNewContext(fs.readFileSync(path.join(client, "node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.js"), "utf8"), context);
const draco = await context.module.exports();
const decoder = new draco.Decoder();
let total = 0, failures = 0;
for (const entry of [map.terrain, ...map.actors, ...map.props]) if (!manifest[entry.asset]) throw new Error(`unknown manifest asset: ${entry.asset}`);
for (const [id, asset] of Object.entries(manifest)) {
  const filename = path.resolve(client, "public", asset.path);
  try {
    assert(filename.startsWith(path.join(client, "public", "assets", "abraxas") + path.sep), "invalid asset path");
    if (id === "terrain" && !fs.existsSync(filename)) { console.warn("terrain: missing; temporary ground required"); continue; }
    const data = fs.readFileSync(filename), { gltf, bin } = parseGlb(data, asset.clips);
    let triangles = 0;
    for (const mesh of gltf.meshes ?? []) for (const primitive of mesh.primitives) {
      assert((primitive.mode ?? 4) === 4, "unsupported primitive");
      const ext = primitive.extensions?.KHR_draco_mesh_compression;
      assert(ext, "missing Draco compression");
      const view = gltf.bufferViews[ext.bufferView];
      assert(view && view.buffer === 0 && (view.byteOffset ?? 0) + view.byteLength <= bin.length, "invalid Draco buffer view");
      const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
      const input = new draco.DecoderBuffer(); input.Init(new Int8Array(bytes), bytes.length);
      const geometry = new draco.Mesh();
      try {
        const status = decoder.DecodeBufferToMesh(input, geometry);
        assert(status.ok(), `Draco decode failed: ${status.error_msg()}`);
        assert(geometry.num_faces() * 3 === gltf.accessors[primitive.indices].count, "index count mismatch");
        triangles += geometry.num_faces();
      } finally { draco.destroy(geometry); draco.destroy(input); }
    }
    assert(triangles > 0, "empty mesh");
    const info = metadata[id]; assert(info && info.path === asset.path, "missing or mismatched metadata");
    assert(data.length === (info.measured?.bytes ?? info.bytes), "metadata byte count mismatch");
    assert(triangles === (info.measured?.triangles ?? info.triangles), "metadata triangle count mismatch");
    assert(triangles <= (info.budget?.maxTriangles ?? info.maxTriangles), "triangle budget exceeded");
    assert(data.length <= (info.budget ? info.budget.maxKiB * 1024 : info.maxBytes), "byte budget exceeded");
    total += data.length;
    console.log(`${id}: ${triangles} triangles, ${data.length} bytes${asset.clips ? `, clips ${asset.clips.join(", ")}` : ""}`);
  } catch (error) { failures++; console.error(`${id}: ${error.message}`); }
}
draco.destroy(decoder);
console.log(`total: ${total} bytes; errors: ${failures}`);
if (failures) process.exitCode = 1;
