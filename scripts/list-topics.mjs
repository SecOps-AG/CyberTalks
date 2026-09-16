#!/usr/bin/env node
/**
 * Prints the topic vocabulary already in use, most-used first. Read this
 * before inventing a topic: reusing "supply-chain" beats coining "supplychain".
 *
 *   node scripts/list-topics.mjs [--min 1] [--json]
 */
import { parseArgs, readJson, villageFiles } from "./lib/util.mjs";

const { args } = parseArgs();
const min = Number.parseInt(args.min ?? "1", 10);

const counts = new Map();
for (const file of villageFiles()) {
  for (const talk of readJson(file).talks ?? []) {
    for (const topic of talk.topics ?? []) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
}

const rows = [...counts.entries()]
  .filter(([, count]) => count >= min)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

if (args.json) {
  console.log(JSON.stringify(Object.fromEntries(rows), null, 2));
} else {
  console.log(`\n  ${rows.length} topics in use\n`);
  for (const [topic, count] of rows) console.log(`  ${String(count).padStart(3)}  ${topic}`);
  console.log("");
}
