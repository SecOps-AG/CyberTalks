import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DATA_DIR = path.join(ROOT, "data");
export const VILLAGE_DIR = path.join(DATA_DIR, "villages");
export const RAW_DIR = path.join(DATA_DIR, "raw");

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function readTaxonomy() {
  return readJson(path.join(DATA_DIR, "taxonomy.json"));
}

export function readEvents() {
  return readJson(path.join(DATA_DIR, "events.json")).events;
}

export function villageFiles() {
  if (!fs.existsSync(VILLAGE_DIR)) return [];
  return fs
    .readdirSync(VILLAGE_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => path.join(VILLAGE_DIR, file));
}

/** Lowercase kebab-case, ASCII only — the shape every slug in data/ must have. */
export function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Minimal flag parser: --key value, --flag. */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        index += 1;
      }
    } else {
      positional.push(token);
    }
  }
  return { args, positional };
}

export function fail(message) {
  console.error(`\n  error  ${message}\n`);
  process.exit(1);
}

export function require_(args, keys, usage) {
  const missing = keys.filter((key) => !args[key]);
  if (missing.length > 0) {
    fail(`missing ${missing.map((key) => `--${key}`).join(", ")}\n\n  usage: ${usage}`);
  }
}

export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
