/**
 * Build public/search-index from the talk-index shards.
 * next.config runs this during `next build` and when `next dev` is missing it.
 */

import fs from "node:fs";
import path from "node:path";
import { buildSearchIndex, type IndexSource } from "../src/lib/search-index/build";

const root = process.cwd();
const shardDir = path.join(root, "public", "data", "talk-index");
const outDir = path.join(root, "public", "search-index");

const files = fs
  .readdirSync(shardDir)
  .filter((file) => file.startsWith("talks-") && file.endsWith(".json"))
  .sort();

const talks: IndexSource[] = [];
for (const file of files) {
  const chunk = JSON.parse(fs.readFileSync(path.join(shardDir, file), "utf8")) as IndexSource[];
  talks.push(...chunk);
}

const started = Date.now();
const { bytes, meta } = buildSearchIndex(talks);
fs.mkdirSync(outDir, { recursive: true });
const binPath = path.join(outDir, "index.bin");
const metaPath = path.join(outDir, "meta.json");
const binTmp = `${binPath}.${process.pid}.tmp`;
const metaTmp = `${metaPath}.${process.pid}.tmp`;
fs.writeFileSync(binTmp, bytes);
fs.writeFileSync(metaTmp, JSON.stringify(meta));
fs.renameSync(binTmp, binPath);
fs.renameSync(metaTmp, metaPath);

const mb = (bytes.byteLength / (1024 * 1024)).toFixed(2);
console.log(
  `search index: ${meta.talks} talks (${meta.sourceRecords} records), ${mb} MB, ${Date.now() - started} ms`,
);
console.log(
  `difficulties: ${meta.difficulties.map((facet) => `${facet.value}=${facet.count}`).join(" ")}`,
);
