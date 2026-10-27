#!/usr/bin/env node
/**
 * Copy difficulty tags from talk-ingest data/talk-groups into CyberTalks data/villages.
 * Only touches the `difficulty` field on matched talks (by youtubeId).
 *
 *   TALK_INGEST_REPO=/path/to/talk-ingest node scripts/merge-difficulty.mjs [--dry-run|--apply]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VILLAGE_DIR, villageFiles } from "./lib/util.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VALID = new Set(["beginner", "intermediate", "advanced", "expert"]);

const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
if (!process.argv.includes("--dry-run") && !process.argv.includes("--apply")) {
  console.error("Usage: node scripts/merge-difficulty.mjs [--dry-run|--apply]");
  process.exit(1);
}

function ingestRoot() {
  const fromEnv = process.env.TALK_INGEST_REPO;
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(ROOT, "..", "talk-ingest");
}

function loadIngestDifficultyMap(ingestRootPath) {
  const groupsDir = path.join(ingestRootPath, "data", "talk-groups");
  if (!fs.existsSync(groupsDir)) {
    throw new Error(
      `talk-ingest not found at ${ingestRootPath} (set TALK_INGEST_REPO to a clone with data/talk-groups)`,
    );
  }
  const map = new Map();
  for (const file of fs.readdirSync(groupsDir).filter((f) => f.endsWith(".json")).sort()) {
    const { talks } = JSON.parse(fs.readFileSync(path.join(groupsDir, file), "utf8"));
    for (const talk of talks) {
      const id = talk.youtubeId;
      if (!id || map.has(id)) continue;
      const level = talk.difficulty;
      if (typeof level === "string" && level.length > 0 && VALID.has(level)) {
        map.set(id, level);
      }
    }
  }
  return map;
}

/** Locate the talk object `{ ... }` that contains this youtubeId line. */
function talkObjectBounds(text, youtubeId) {
  const needle = `"youtubeId": "${youtubeId}"`;
  const idIdx = text.indexOf(needle);
  if (idIdx === -1) return null;

  let objStart = text.lastIndexOf("\n    {", idIdx);
  if (objStart === -1) objStart = text.lastIndexOf("{", idIdx);
  else objStart += 1;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = objStart; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return { start: objStart, end: i + 1, idIdx };
    }
  }
  return null;
}

function patchTalkObject(talkText, newLevel) {
  const diffRe = /(\n      "difficulty": )"([^"]+)"/;
  if (diffRe.test(talkText)) {
    const current = talkText.match(diffRe)[2];
    if (current === newLevel) return { text: talkText, action: "unchanged" };
    return { text: talkText.replace(diffRe, `$1"${newLevel}"`), action: "change" };
  }

  const insertLine = `\n      "difficulty": "${newLevel}"`;

  const conferenceRe = /(\n      "conference": "[^"]+",?)/;
  if (conferenceRe.test(talkText)) {
    return {
      text: talkText.replace(conferenceRe, (m) => {
        const withComma = m.endsWith(",") ? m : `${m},`;
        return `${withComma}${insertLine}`;
      }),
      action: "add",
    };
  }

  const durationRe = /(\n      "durationSeconds": (\d+))(\n)/;
  if (durationRe.test(talkText)) {
    return {
      text: talkText.replace(durationRe, `$1,${insertLine}$3`),
      action: "add",
    };
  }

  const languageRe = /(\n      "language": "[^"]+",?)(\n)/;
  if (languageRe.test(talkText)) {
    return {
      text: talkText.replace(languageRe, (m, prefix, nl) => {
        const withComma = prefix.endsWith(",") ? prefix : `${prefix},`;
        return `${withComma}${insertLine}${nl}`;
      }),
      action: "add",
    };
  }

  const publishedRe = /(\n      "publishedAt": "[^"]+",?)(\n)/;
  if (publishedRe.test(talkText)) {
    return {
      text: talkText.replace(publishedRe, (m, prefix, nl) => {
        const withComma = prefix.endsWith(",") ? prefix : `${prefix},`;
        return `${withComma}${insertLine}${nl}`;
      }),
      action: "add",
    };
  }

  const viewRe = /(\n      "viewCount": )/;
  if (viewRe.test(talkText)) {
    return { text: talkText.replace(viewRe, `${insertLine},$1`), action: "add" };
  }

  const closing = talkText.lastIndexOf("\n    }");
  if (closing !== -1) {
    return {
      text: `${talkText.slice(0, closing)},${insertLine}${talkText.slice(closing)}`,
      action: "add",
    };
  }

  return null;
}

function emptyStats() {
  return {
    add: { beginner: 0, intermediate: 0, advanced: 0, expert: 0 },
    change: { beginner: 0, intermediate: 0, advanced: 0, expert: 0 },
    unchanged: { beginner: 0, intermediate: 0, advanced: 0, expert: 0 },
    filesTouched: 0,
    talksPatched: 0,
  };
}

function bump(bucket, level) {
  bucket[level] = (bucket[level] ?? 0) + 1;
}

function processVillageFile(filePath, ingestMap, stats) {
  const original = fs.readFileSync(filePath, "utf8");
  let text = original;
  const village = JSON.parse(original);
  const pending = [];

  for (const talk of village.talks) {
    const level = ingestMap.get(talk.youtubeId);
    if (!level) continue;
    const current = talk.difficulty;
    if (current === level) {
      bump(stats.unchanged, level);
      continue;
    }
    pending.push({ youtubeId: talk.youtubeId, level, had: current });
  }

  if (pending.length === 0) return false;

  for (const { youtubeId, level } of pending) {
    const bounds = talkObjectBounds(text, youtubeId);
    if (!bounds) continue;
    const slice = text.slice(bounds.start, bounds.end);
    const patched = patchTalkObject(slice, level);
    if (!patched) continue;
    if (patched.action === "unchanged") {
      bump(stats.unchanged, level);
      continue;
    }
    text = text.slice(0, bounds.start) + patched.text + text.slice(bounds.end);
    bump(stats[patched.action], level);
    stats.talksPatched += 1;
  }

  if (text === original) return false;
  stats.filesTouched += 1;
  if (mode === "apply") fs.writeFileSync(filePath, text);
  return true;
}

function printStats(label, stats, ingestMap) {
  console.log(label);
  console.log("  would add / added:", stats.add);
  console.log("  would change / changed:", stats.change);
  console.log("  unchanged (already correct):", stats.unchanged);
  console.log(`  files touched: ${stats.filesTouched}, talks patched: ${stats.talksPatched}`);
  const siteIds = new Set();
  for (const file of villageFiles()) {
    const { talks } = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const t of talks) siteIds.add(t.youtubeId);
  }
  let unmatched = 0;
  const unmatchedByLevel = { beginner: 0, intermediate: 0, advanced: 0, expert: 0 };
  for (const [id, level] of ingestMap) {
    if (!siteIds.has(id)) {
      unmatched += 1;
      unmatchedByLevel[level] += 1;
    }
  }
  console.log(`  ingest levels not on site (unmatched): ${unmatched}`, unmatchedByLevel);
}

const ingestMap = loadIngestDifficultyMap(ingestRoot());
console.log(`Loaded ${ingestMap.size} talks with valid difficulty from talk-ingest`);
console.log(`Mode: ${mode}`);

const stats = emptyStats();
for (const file of villageFiles()) {
  processVillageFile(file, ingestMap, stats);
}
printStats(mode === "apply" ? "Apply results:" : "Dry-run results:", stats, ingestMap);

if (mode === "dry-run") {
  const totalOps =
    Object.values(stats.add).reduce((a, b) => a + b, 0) +
    Object.values(stats.change).reduce((a, b) => a + b, 0);
  console.log(`Total talks that would be updated: ${totalOps}`);
}
