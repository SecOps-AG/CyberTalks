#!/usr/bin/env node
/**
 * Offline guard: non-DEF CON editions must never appear in village facets/series.
 * Keep `inDefconVillage` in sync with src/lib/hubs.ts.
 */
import fs from "node:fs";
import path from "node:path";

const VILLAGE_DIR = path.join(process.cwd(), "data/villages");

/** @param {{ conference: string; eventSlug: string }} item */
function inDefconVillage(item) {
  return (
    item.conference === "defcon" &&
    (item.eventSlug.startsWith("defcon-") || item.eventSlug === "defcon-safe-mode")
  );
}

function getDefconVillagesFromDisk() {
  const bySlug = new Map();
  for (const file of fs.readdirSync(VILLAGE_DIR).filter((name) => name.endsWith(".json"))) {
    const stored = JSON.parse(fs.readFileSync(path.join(VILLAGE_DIR, file), "utf8"));
    if (!inDefconVillage(stored)) continue;
    const list = bySlug.get(stored.villageSlug) ?? [];
    list.push(stored);
    bySlug.set(stored.villageSlug, list);
  }
  return bySlug;
}

const errors = [];
const defconSeries = getDefconVillagesFromDisk();

for (const file of fs.readdirSync(VILLAGE_DIR).filter((name) => name.endsWith(".json"))) {
  const stored = JSON.parse(fs.readFileSync(path.join(VILLAGE_DIR, file), "utf8"));
  if (inDefconVillage(stored)) continue;

  if (defconSeries.has(stored.villageSlug) && stored.villageName.toLowerCase().includes("village")) {
    errors.push(
      `${file}: non-DEF CON edition shares a DEF CON village slug "${stored.villageSlug}"`,
    );
  }

  if (inDefconVillage(stored)) {
    errors.push(`${file}: failed exclusion — non-defcon file passed inDefconVillage`);
  }
}

const nonDefcon = fs
  .readdirSync(VILLAGE_DIR)
  .filter((name) => name.endsWith(".json"))
  .map((name) => JSON.parse(fs.readFileSync(path.join(VILLAGE_DIR, name), "utf8")))
  .filter((stored) => !inDefconVillage(stored));

for (const stored of nonDefcon) {
  const included = [...defconSeries.keys()].includes(stored.villageSlug);
  if (included && stored.conference !== "defcon") {
    errors.push(
      `getDefconVillages would include non-defcon slug "${stored.villageSlug}" (${stored.conference})`,
    );
  }
}

if (defconSeries.size === 0) {
  errors.push("getDefconVillages: expected at least one DEF CON village series");
}

if (errors.length > 0) {
  console.error("check-defcon-villages failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

console.log(
  `check-defcon-villages ok (${defconSeries.size} DEF CON village series; ${nonDefcon.length} non-DEF CON storage editions excluded)`,
);
