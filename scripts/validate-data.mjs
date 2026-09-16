#!/usr/bin/env node
/**
 * The gate between an edit under data/ and a green build.
 * Errors exit 1. Warnings are advisory and mostly catch taxonomy drift —
 * a topic invented when a near-identical one already exists.
 *
 *   node scripts/validate-data.mjs [--strict]
 */
import path from "node:path";
import {
  DATA_DIR,
  parseArgs,
  readEvents,
  readJson,
  readTaxonomy,
  SLUG,
  villageFiles,
  YOUTUBE_ID,
} from "./lib/util.mjs";

const { args } = parseArgs();

const errors = [];
const warnings = [];
const error = (where, message) => errors.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);

const TALK_FIELDS = new Set([
  "youtubeId",
  "slug",
  "title",
  "speakers",
  "track",
  "topics",
  "teaser",
  "summary",
  "durationSeconds",
  "publishedAt",
]);

const VILLAGE_FIELDS = new Set([
  "villageSlug",
  "villageName",
  "eventSlug",
  "playlistUrl",
  "description",
  "talks",
]);

const MAX_TOPICS = 6;
const MAX_TEASER = 220;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

function isYouTubeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && YOUTUBE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/* ---------- events ---------- */

const events = readEvents();
const eventSlugs = new Set();
for (const event of events) {
  const where = `events.json / ${event.slug ?? "?"}`;
  for (const field of ["slug", "name", "shortName", "dates", "location"]) {
    if (typeof event[field] !== "string" || !event[field].trim()) {
      error(where, `"${field}" must be a non-empty string`);
    }
  }
  if (!Number.isInteger(event.year)) error(where, `"year" must be an integer`);
  if (typeof event.slug === "string") {
    if (!SLUG.test(event.slug)) error(where, `slug "${event.slug}" is not kebab-case`);
    if (eventSlugs.has(event.slug)) error(where, "duplicate event slug");
    eventSlugs.add(event.slug);
  }
}

/* ---------- taxonomy ---------- */

const taxonomy = readTaxonomy();
const trackSlugs = new Set();
for (const track of taxonomy.tracks ?? []) {
  const where = `taxonomy.json / ${track.slug ?? "?"}`;
  if (!SLUG.test(track.slug ?? "")) error(where, "track slug must be kebab-case");
  if (trackSlugs.has(track.slug)) error(where, "duplicate track slug");
  trackSlugs.add(track.slug);
  if (!track.name) error(where, `"name" is required`);
}
if (trackSlugs.size === 0) error("taxonomy.json", "no tracks defined");

/* ---------- villages ---------- */

const files = villageFiles();
if (files.length === 0) error("data/villages", "no village files found");

const seenSlugs = new Map();
const seenVideoIds = new Map();
const topicCounts = new Map();
const villageKeys = new Set();
let talkTotal = 0;
let missingSummaries = 0;

for (const file of files) {
  const name = path.basename(file);
  const where = `villages/${name}`;
  let village;
  try {
    village = readJson(file);
  } catch (cause) {
    error(where, `is not valid JSON (${cause.message})`);
    continue;
  }

  for (const key of Object.keys(village)) {
    if (!VILLAGE_FIELDS.has(key)) warn(where, `unknown field "${key}"`);
  }
  for (const field of ["villageSlug", "villageName", "eventSlug", "playlistUrl"]) {
    if (typeof village[field] !== "string" || !village[field].trim()) {
      error(where, `"${field}" must be a non-empty string`);
    }
  }
  if (!SLUG.test(village.villageSlug ?? "")) {
    error(where, `villageSlug "${village.villageSlug}" is not kebab-case`);
  }
  if (!eventSlugs.has(village.eventSlug)) {
    error(where, `eventSlug "${village.eventSlug}" is not in data/events.json`);
  }
  const expected = `${village.eventSlug}-${village.villageSlug}.json`;
  if (name !== expected) error(where, `filename should be "${expected}"`);

  const key = `${village.eventSlug}/${village.villageSlug}`;
  if (villageKeys.has(key)) error(where, `duplicate village ${key}`);
  villageKeys.add(key);

  // The URL is rendered as a link on the village page, so the host is checked
  // rather than pattern-matched: "https://elsewhere.example/?youtube.com" used
  // to pass a substring test.
  if (typeof village.playlistUrl === "string" && !isYouTubeUrl(village.playlistUrl)) {
    error(where, `playlistUrl "${village.playlistUrl}" must be an https YouTube URL`);
  }
  if (!village.description || !String(village.description).trim()) {
    error(where, `"description" is empty — one or two sentences about the village`);
  }

  if (!Array.isArray(village.talks) || village.talks.length === 0) {
    error(where, `"talks" must be a non-empty array`);
    continue;
  }

  village.talks.forEach((talk, index) => {
    const at = `${where} [${index}] ${talk?.slug ?? talk?.youtubeId ?? "?"}`;
    talkTotal += 1;

    if (!talk || typeof talk !== "object") {
      error(at, "talk must be an object");
      return;
    }
    for (const key of Object.keys(talk)) {
      if (!TALK_FIELDS.has(key)) warn(at, `unknown field "${key}"`);
    }

    if (!YOUTUBE_ID.test(talk.youtubeId ?? "")) {
      error(at, `youtubeId "${talk.youtubeId}" must be 11 URL-safe characters`);
    } else if (seenVideoIds.has(talk.youtubeId)) {
      error(at, `youtubeId already used in ${seenVideoIds.get(talk.youtubeId)}`);
    } else {
      seenVideoIds.set(talk.youtubeId, at);
    }

    if (!SLUG.test(talk.slug ?? "")) {
      error(at, `slug "${talk.slug}" must be kebab-case`);
    } else if (seenSlugs.has(talk.slug)) {
      error(at, `slug "${talk.slug}" already used in ${seenSlugs.get(talk.slug)}`);
    } else {
      seenSlugs.set(talk.slug, at);
    }

    if (typeof talk.title !== "string" || !talk.title.trim()) error(at, "title is empty");
    if (typeof talk.title === "string" && /^def\s*con/i.test(talk.title.trim())) {
      error(at, `title still has the "DEF CON …" prefix from the video title`);
    }

    if (!Array.isArray(talk.speakers)) error(at, "speakers must be an array");
    else if (talk.speakers.some((speaker) => typeof speaker !== "string" || !speaker.trim())) {
      error(at, "speakers must all be non-empty strings");
    } else if (talk.speakers.length === 0) {
      warn(at, "no speakers listed");
    } else {
      for (const speaker of talk.speakers) {
        const name = speaker.trim();
        if (
          /^(panels?|video\s*team|videoteam)$/i.test(name) ||
          /\bvillage\b/i.test(name) ||
          /^def\s*con\b/i.test(name)
        ) {
          warn(at, `speaker "${speaker}" looks like a village/event label, not a person`);
        }
      }
    }

    if (!talk.track) error(at, "track is empty — pick one from data/taxonomy.json");
    else if (!trackSlugs.has(talk.track)) {
      error(at, `track "${talk.track}" is not in data/taxonomy.json`);
    }

    if (!Array.isArray(talk.topics)) {
      error(at, "topics must be an array");
    } else {
      if (talk.topics.length === 0) error(at, "topics is empty — add 3 to 6");
      if (talk.topics.length > MAX_TOPICS) {
        error(at, `${talk.topics.length} topics, max ${MAX_TOPICS}`);
      }
      if (new Set(talk.topics).size !== talk.topics.length) error(at, "duplicate topics");
      for (const topic of talk.topics) {
        if (typeof topic !== "string" || !SLUG.test(topic)) {
          error(at, `topic "${topic}" must be lowercase kebab-case`);
        } else {
          topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
        }
      }
    }

    if (typeof talk.teaser !== "string" || !talk.teaser.trim()) {
      error(at, "teaser is empty — one sentence, what the talk delivers");
    } else if (talk.teaser.length > MAX_TEASER) {
      error(at, `teaser is ${talk.teaser.length} chars, max ${MAX_TEASER}`);
    }

    if (talk.summary != null && typeof talk.summary !== "string" && typeof talk.summary !== "object") {
      error(at, "summary must be a string, an object, or null");
    }
    if (talk.summary == null || talk.summary === "") missingSummaries += 1;

    if (talk.durationSeconds != null && !Number.isFinite(talk.durationSeconds)) {
      error(at, "durationSeconds must be a number");
    }
  });
}

/* ---------- taxonomy drift ---------- */

const singletons = [...topicCounts.entries()].filter(([, count]) => count === 1);
for (const [topic] of singletons) {
  const near = [...topicCounts.keys()].find(
    (other) =>
      other !== topic &&
      (other === `${topic}s` ||
        topic === `${other}s` ||
        other.replace(/-/g, "") === topic.replace(/-/g, "")),
  );
  if (near) warn("topics", `"${topic}" looks like a duplicate of "${near}" — pick one`);
}

/* ---------- report ---------- */

const label = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

console.log("");
console.log(`  events   ${events.length}`);
console.log(`  villages ${files.length}`);
console.log(`  talks    ${talkTotal}`);
console.log(`  topics   ${topicCounts.size}`);
if (missingSummaries > 0) console.log(`  no summary yet: ${missingSummaries}`);

if (warnings.length > 0) {
  console.log(`\n  ${label(warnings.length, "warning")}:`);
  for (const message of warnings) console.log(`    - ${message}`);
}

if (errors.length > 0) {
  console.log(`\n  ${label(errors.length, "error")}:`);
  for (const message of errors) console.log(`    - ${message}`);
  console.log("");
  process.exit(1);
}

if (args.strict && warnings.length > 0) {
  console.log("\n  --strict: warnings are fatal\n");
  process.exit(1);
}

console.log(`\n  data/ is valid (${path.relative(process.cwd(), DATA_DIR)})\n`);
