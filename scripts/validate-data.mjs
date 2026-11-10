#!/usr/bin/env node
/**
 * The gate between an edit under data/ and a green build.
 * Errors exit 1. Warnings are advisory and mostly catch taxonomy drift —
 * a topic invented when a near-identical one already exists.
 *
 *   node scripts/validate-data.mjs [--strict]
 */
import fs from "node:fs";
import path from "node:path";
import {
  DATA_DIR,
  parseArgs,
  readEvents,
  readJson,
  readTaxonomy,
  SLUG,
  villageFiles,
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
  "language",
  "viewCount",
  "likeCount",
  "commentCount",
  "viewCountFetchedAt",
  "difficulty",
  "conference",
  "kind",
  "mediaUrl",
  "thumbnail",
  "enrichmentGaps",
  "year",
  "eventLabel",
]);

const VILLAGE_FIELDS = new Set([
  "villageSlug",
  "villageName",
  "eventSlug",
  "conference",
  "language",
  "playlistUrl",
  "description",
  "talks",
]);

/** Known conference family slugs. Extend when adding a new conference. */
const KNOWN_CONFERENCES = new Set(["defcon", "black-hat", "rsa", "troopers"]);

const MAX_TOPICS = 6;
const DIFFICULTIES = new Set(["beginner", "intermediate", "advanced", "expert"]);
const LANGUAGE = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const MAX_TEASER = 220;

const TALK_ID = /^(?:[A-Za-z0-9_-]{11}|dc3[34]-[a-f0-9]{8})$/;
const MATERIAL_TYPES = new Set([
  "slides",
  "repo",
  "paper",
  "whitepaper",
  "demo",
  "recording",
  "tool",
  "speaker-link",
  "reference",
  "link",
]);

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
  for (const field of ["villageSlug", "villageName", "eventSlug", "conference", "playlistUrl"]) {
    if (typeof village[field] !== "string" || !village[field].trim()) {
      error(where, `"${field}" must be a non-empty string`);
    }
  }
  if (!SLUG.test(village.villageSlug ?? "")) {
    error(where, `villageSlug "${village.villageSlug}" is not kebab-case`);
  }
  if (!SLUG.test(village.conference ?? "")) {
    error(where, `conference "${village.conference}" is not kebab-case`);
  } else if (!KNOWN_CONFERENCES.has(village.conference)) {
    warn(where, `conference "${village.conference}" is not in the known list (${[...KNOWN_CONFERENCES].join(", ")}) — allowed for multi-conference kitchen`);
  }
  if (village.language != null && !LANGUAGE.test(village.language)) {
    error(where, `language "${village.language}" must be a BCP 47 tag like "en" or "pt-BR"`);
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

    const gaps = talk.enrichmentGaps;
    const gapOk =
      gaps != null &&
      typeof gaps === "object" &&
      !Array.isArray(gaps) &&
      Object.values(gaps).every((value) => typeof value === "string" && value.trim());
    if (talk.enrichmentGaps != null && !gapOk) {
      error(at, "enrichmentGaps must be an object of non-empty strings");
    }

    if (!TALK_ID.test(talk.youtubeId ?? "")) {
      error(at, `youtubeId "${talk.youtubeId}" must be a YouTube id or a dc33-/dc34- media id`);
    } else if (seenVideoIds.has(talk.youtubeId)) {
      warn(at, `youtubeId already used in ${seenVideoIds.get(talk.youtubeId)} — kitchen may republish across villages`);
    } else {
      seenVideoIds.set(talk.youtubeId, at);
    }

    if (!SLUG.test(talk.slug ?? "")) {
      error(at, `slug "${talk.slug}" must be kebab-case`);
    } else if (seenSlugs.has(talk.slug)) {
      warn(at, `slug "${talk.slug}" already used in ${seenSlugs.get(talk.slug)} — allowed when the same talk appears at multiple conferences`);
    } else {
      seenSlugs.set(talk.slug, at);
    }

    if (typeof talk.title !== "string" || !talk.title.trim()) error(at, "title is empty");
    if (typeof talk.title === "string" && /^def\s*con/i.test(talk.title.trim())) {
      warn(at, `title still has the "DEF CON …" prefix from the video title`);
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

    if (!talk.track) {
      if (!gapOk) error(at, "track is empty — pick one from data/taxonomy.json");
    } else if (!trackSlugs.has(talk.track)) {
      error(at, `track "${talk.track}" is not in data/taxonomy.json`);
    }

    if (!Array.isArray(talk.topics)) {
      error(at, "topics must be an array");
    } else {
      if (talk.topics.length === 0 && !gapOk) error(at, "topics is empty — add 3 to 6");
      if (talk.topics.length > MAX_TOPICS) {
        error(at, `${talk.topics.length} topics, max ${MAX_TOPICS}`);
      }
      if (new Set(talk.topics).size !== talk.topics.length) error(at, "duplicate topics");
      for (const topic of talk.topics) {
        if (typeof topic !== "string" || !SLUG.test(topic)) {
          warn(at, `topic "${topic}" must be lowercase kebab-case`);
        } else {
          topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
        }
      }
    }

    if (typeof talk.teaser !== "string" || !talk.teaser.trim()) {
      if (!gapOk) error(at, "teaser is empty — one sentence, what the talk delivers");
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
    if (talk.year != null && !(Number.isInteger(talk.year) && talk.year >= 1990 && talk.year <= 2100)) {
      error(at, `year "${talk.year}" must be a four digit year`);
    }
    if (talk.eventLabel != null && (typeof talk.eventLabel !== "string" || !talk.eventLabel.trim())) {
      error(at, "eventLabel must be a non-empty string");
    }
    if (talk.language != null && !LANGUAGE.test(talk.language)) {
      error(at, `language "${talk.language}" must be a BCP 47 tag like "en" or "pt-BR"`);
    }
    if (talk.viewCount != null && !(Number.isInteger(talk.viewCount) && talk.viewCount >= 0)) {
      error(at, "viewCount must be a non-negative integer");
    }
    if (talk.likeCount != null && !(Number.isInteger(talk.likeCount) && talk.likeCount >= 0)) {
      error(at, "likeCount must be a non-negative integer");
    }
    if (talk.commentCount != null && !(Number.isInteger(talk.commentCount) && talk.commentCount >= 0)) {
      error(at, "commentCount must be a non-negative integer");
    }
    if (talk.viewCountFetchedAt != null && Number.isNaN(Date.parse(talk.viewCountFetchedAt))) {
      error(at, "viewCountFetchedAt must be an ISO timestamp");
    }
    // Unclassified talks omit the field; there is no "unknown" value.
    if (talk.kind != null && !["talk", "clip", "interview", "announcement"].includes(talk.kind)) {
      error(at, `kind "${talk.kind}" is not a known kind`);
    }
    const mediaId = typeof talk.youtubeId === "string" && /^dc3[34]-/.test(talk.youtubeId);
    if (mediaId) {
      if (typeof talk.mediaUrl !== "string" || !talk.mediaUrl.startsWith("https://")) {
        error(at, "mediaUrl must be an https URL");
      }
      const thumb = typeof talk.thumbnail === "string" ? talk.thumbnail : "";
      if (thumb !== `/materials/thumbs/${talk.youtubeId}.jpg`) {
        error(at, "thumbnail must be a /materials/thumbs/<id>.jpg path");
      } else if (!fs.existsSync(path.join(process.cwd(), "public", thumb))) {
        error(at, `thumbnail file public${thumb} is missing`);
      }
    } else if (talk.mediaUrl != null && talk.mediaUrl !== "") {
      error(at, "mediaUrl is only for talks that are not on YouTube");
    }
    if ("difficulty" in talk && talk.difficulty != null && !DIFFICULTIES.has(talk.difficulty)) {
      error(
        at,
        `difficulty ${JSON.stringify(talk.difficulty)} must be one of ${[...DIFFICULTIES].join(", ")} — omit the field when unclassified`,
      );
    }
  });
}

/* ---------- materials ---------- */

const materialsDir = path.join(DATA_DIR, "materials");
if (fs.existsSync(materialsDir)) {
  for (const file of fs.readdirSync(materialsDir).filter((name) => name.endsWith(".json"))) {
    const where = `materials/${file}`;
    if (file.startsWith("_")) {
      warn(where, "underscore files are not joined onto talks");
      continue;
    }
    const id = file.slice(0, -".json".length);
    if (!seenVideoIds.has(id)) warn(where, `"${id}" is not a talk in data/villages`);
    let links;
    try {
      links = readJson(path.join(materialsDir, file));
    } catch (cause) {
      error(where, `is not valid JSON (${cause.message})`);
      continue;
    }
    if (!Array.isArray(links)) {
      error(where, "must be an array of links");
      continue;
    }
    links.forEach((link, index) => {
      const at = `${where} [${index}]`;
      if (!link || typeof link !== "object") {
        error(at, "link must be an object");
        return;
      }
      if (!MATERIAL_TYPES.has(link.type)) error(at, `type "${link.type}" is not a known material type`);
      if (typeof link.url !== "string" || !/^https?:\/\//.test(link.url)) {
        error(at, "url must be http or https");
      }
      if (link.confidence != null && typeof link.confidence !== "number") {
        error(at, "confidence must be a number");
      }
      if (typeof link.source !== "string" || !link.source.trim()) error(at, "source is empty");
    });
  }
}

/* ---------- view counts ---------- */

const viewCountsFile = path.join(DATA_DIR, "view-counts.json");
let viewCountTotal = 0;
if (fs.existsSync(viewCountsFile)) {
  const where = "view-counts.json";
  let counts = {};
  try {
    counts = readJson(viewCountsFile).counts ?? {};
  } catch (cause) {
    error(where, `is not valid JSON (${cause.message})`);
  }
  for (const [id, entry] of Object.entries(counts)) {
    viewCountTotal += 1;
    if (!seenVideoIds.has(id)) warn(where, `"${id}" is not a talk in data/villages`);
    if (!Number.isInteger(entry?.viewCount) || entry.viewCount < 0) {
      error(where, `"${id}" viewCount must be a non-negative integer`);
    }
    if (entry?.likeCount != null && (!Number.isInteger(entry.likeCount) || entry.likeCount < 0)) {
      error(where, `"${id}" likeCount must be a non-negative integer`);
    }
    if (entry?.commentCount != null && (!Number.isInteger(entry.commentCount) || entry.commentCount < 0)) {
      error(where, `"${id}" commentCount must be a non-negative integer`);
    }
    if (Number.isNaN(Date.parse(entry?.fetchedAt))) {
      error(where, `"${id}" fetchedAt must be an ISO timestamp`);
    }
  }
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
if (viewCountTotal > 0) console.log(`  views    ${viewCountTotal} talks with a count`);
if (missingSummaries > 0) console.log(`  no summary yet: ${missingSummaries}`);

const MAX_PRINTED_WARNINGS = 40;
if (warnings.length > 0) {
  console.log(`\n  ${label(warnings.length, "warning")}:`);
  const printed = warnings.slice(0, MAX_PRINTED_WARNINGS);
  for (const message of printed) console.log(`    - ${message}`);
  const remaining = warnings.length - printed.length;
  if (remaining > 0) console.log(`    … and ${remaining} more`);
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
