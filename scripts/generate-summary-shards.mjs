#!/usr/bin/env node

/**
 * Generate per-year summary shards for client-side fetching.
 *
 * Creates JSON files in public/data/summaries/ with structure:
 * { id: string; summary?: string }[]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const VILLAGE_DIR = path.join(projectRoot, "data", "villages");
const OUTPUT_DIR = path.join(projectRoot, "public", "data", "summaries");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function generateShards() {
  const shards = new Map();

  const villageFiles = fs
    .readdirSync(VILLAGE_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  for (const file of villageFiles) {
    const edition = readJson(path.join(VILLAGE_DIR, file));
    const eventMatch = file.match(/^(.+?)-[^-]+\.json$/);
    if (!eventMatch) continue;

    const eventSlug = eventMatch[1];
    const events = readJson(path.join(projectRoot, "data", "events.json")).events;
    const event = events.find((e) => e.slug === eventSlug);
    if (!event) continue;

    const year = event.year;
    if (!shards.has(year)) {
      shards.set(year, []);
    }

    const yearShards = shards.get(year);
    for (const talk of edition.talks) {
      const talkId = `${eventSlug}-${edition.villageSlug}-${talk.youtubeId}`;
      const summary =
        typeof talk.summary === "string" ? talk.summary : talk.summary?.overview || null;
      yearShards.push({ id: talkId, summary });
    }
  }

  ensureDir(OUTPUT_DIR);

  for (const [year, entries] of shards) {
    const outputFile = path.join(OUTPUT_DIR, `summaries-${year}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(entries, null, 2));
    console.log(`Generated ${entries.length} summaries for ${year}: ${outputFile}`);
  }

  console.log(`Generated ${shards.size} year shards`);
}

generateShards().catch(console.error);
