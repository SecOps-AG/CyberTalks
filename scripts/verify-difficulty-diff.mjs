#!/usr/bin/env node
/**
 * After merge-difficulty --apply, ensure git diff only touches difficulty lines.
 * Usage: git diff -- data/villages | node scripts/verify-difficulty-diff.mjs
 */
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin });
const bad = [];

for await (const line of rl) {
  if (!line.startsWith("+") && !line.startsWith("-")) continue;
  if (line.startsWith("+++") || line.startsWith("---")) continue;
  const body = line.slice(1).trim();
  if (body === "" || body === "{" || body === "}" || body === "]," || body === "[") continue;
  if (/^"difficulty":/.test(body)) continue;
  if (/^[+-]\s*$/.test(line)) continue;
  bad.push(line);
}

if (bad.length) {
  console.error("Non-difficulty lines in diff:");
  for (const l of bad.slice(0, 30)) console.error(l);
  if (bad.length > 30) console.error(`... and ${bad.length - 30} more`);
  process.exit(1);
}
console.log("OK: all changed lines are difficulty-only");
