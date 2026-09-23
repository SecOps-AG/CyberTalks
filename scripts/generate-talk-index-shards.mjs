#!/usr/bin/env node

/**
 * Generate per-year talk-index shards for client-side fetching.
 *
 * Mirrors TalkIndexEntry / buildIndexEntry (src/lib/search.ts) and the
 * denormalisation in getArchive (src/lib/data.ts).
 *
 * Writes:
 *   public/data/talk-index/years.json       → sorted number[]
 *   public/data/talk-index/talks-{year}.json → TalkIndexEntry[]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const DATA_DIR = path.join(projectRoot, "data");
const VILLAGE_DIR = path.join(DATA_DIR, "villages");
const OUTPUT_DIR = path.join(projectRoot, "public", "data", "talk-index");

const DIFFICULTIES = new Set(["beginner", "intermediate", "advanced", "expert"]);

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const COUNTRIES = new Set([
  "usa",
  "us",
  "germany",
  "china",
  "uk",
  "canada",
  "france",
  "japan",
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function dateLabel(dates, year) {
  const lower = String(dates).toLowerCase();
  const month = MONTHS.find((name) => lower.includes(name));
  if (!month) return String(year);
  const short = month.slice(0, 3);
  return `${short[0].toUpperCase()}${short.slice(1)} ${year}`;
}

function locationLabel(location) {
  if (/virtual|discord|twitch|\(vr\)/i.test(location)) return "Online";
  if (/las vegas/i.test(location)) return "Las Vegas";
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return location;
  const last = parts[parts.length - 1];
  if (parts.length > 1 && COUNTRIES.has(last.toLowerCase())) {
    return parts[parts.length - 2];
  }
  return last;
}

function normalizeDifficulty(value) {
  return DIFFICULTIES.has(value) ? value : null;
}

/** Mirror of deriveKind in src/lib/data.ts */
function deriveKind(talk, villageSlug) {
  if (talk.kind) return talk.kind;
  const title = talk.title.toLowerCase();
  const vs = villageSlug.toLowerCase();
  const dur = talk.durationSeconds ?? 0;

  if (
    vs.includes("interview") ||
    title.startsWith("interview with") ||
    title.startsWith("conversation with") ||
    /\b(interview|interviews)\b/i.test(title) ||
    /\b(q&a|qa) with\b/i.test(title)
  ) {
    return "interview";
  }

  if (
    (talk.topics && talk.topics.includes("announcement")) ||
    /\b(opening remarks|closing remarks|opening ceremony|closing ceremony|prize distribution|awards ceremony)\b/i.test(
      title,
    ) ||
    /\b(cfp extended|housekeeping|welcome & intro|welcome and intro|intro & welcome)\b/i.test(
      title,
    )
  ) {
    return "announcement";
  }

  if (
    vs.includes("extras") ||
    /\b(trailer|teaser|promo|bonus clip|bonus clips|short)\b/i.test(title) ||
    (dur > 0 && dur < 300)
  ) {
    return "clip";
  }

  return "talk";
}

function buildIndexEntry({
  talk,
  event,
  edition,
  trackName,
  viewCount,
  topics,
}) {
  const difficulty = normalizeDifficulty(talk.difficulty) ?? undefined;
  const entry = {
    id: `${edition.eventSlug}-${edition.villageSlug}-${talk.youtubeId}`,
    slug: talk.slug,
    title: talk.title,
    teaser: talk.teaser,
    speakers: talk.speakers,
    youtubeId: talk.youtubeId,
    year: event.year,
    eventSlug: event.slug,
    conference: edition.conference,
    eventShortName: event.shortName,
    villageSlug: edition.villageSlug,
    villageName: edition.villageName,
    track: talk.track,
    trackName,
    topics,
    durationSeconds: talk.durationSeconds,
    kind: deriveKind(talk, edition.villageSlug),
    dateLabel: dateLabel(event.dates, event.year),
    locationLabel: locationLabel(event.location),
    language: talk.language ?? edition.language,
    viewCount: talk.viewCount ?? viewCount,
    difficulty,
  };

  // Drop undefined so the wire shape matches JSON from buildIndexEntry.
  for (const key of Object.keys(entry)) {
    if (entry[key] === undefined) delete entry[key];
  }
  return entry;
}

function generateShards() {
  const events = readJson(path.join(DATA_DIR, "events.json")).events;
  const eventBySlug = new Map(events.map((e) => [e.slug, e]));

  const taxonomy = readJson(path.join(DATA_DIR, "taxonomy.json"));
  const trackBySlug = new Map(
    (taxonomy.tracks || []).map((t) => [t.slug, t]),
  );
  const topicAliases = taxonomy.topicAliases || {};

  const viewCountsFile = path.join(DATA_DIR, "view-counts.json");
  const viewCounts = fs.existsSync(viewCountsFile)
    ? readJson(viewCountsFile).counts || {}
    : {};

  const shards = new Map();

  const villageFiles = fs
    .readdirSync(VILLAGE_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  for (const file of villageFiles) {
    const edition = readJson(path.join(VILLAGE_DIR, file));
    const event = eventBySlug.get(edition.eventSlug);
    if (!event) {
      console.warn(
        `Skipping ${file}: unknown event "${edition.eventSlug}"`,
      );
      continue;
    }

    const year = event.year;
    if (!shards.has(year)) shards.set(year, []);
    const yearShards = shards.get(year);

    for (const talk of edition.talks) {
      const topics = (talk.topics || []).map(
        (topic) => topicAliases[topic] ?? topic,
      );
      const views = viewCounts[talk.youtubeId];
      yearShards.push(
        buildIndexEntry({
          talk,
          event,
          edition,
          trackName: trackBySlug.get(talk.track)?.name ?? talk.track,
          viewCount: views?.viewCount,
          topics,
        }),
      );
    }
  }

  ensureDir(OUTPUT_DIR);

  // Wipe stale year files so removed years do not linger.
  for (const existing of fs.readdirSync(OUTPUT_DIR)) {
    if (
      existing === "years.json" ||
      /^talks-\d+\.json$/.test(existing)
    ) {
      fs.unlinkSync(path.join(OUTPUT_DIR, existing));
    }
  }

  const years = [...shards.keys()].sort((a, b) => a - b);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "years.json"),
    JSON.stringify(years),
  );

  let maxBytes = 0;
  let maxYear = null;
  let totalTalks = 0;

  for (const year of years) {
    const entries = shards.get(year);
    totalTalks += entries.length;
    const outputFile = path.join(OUTPUT_DIR, `talks-${year}.json`);
    const body = JSON.stringify(entries);
    fs.writeFileSync(outputFile, body);
    const bytes = Buffer.byteLength(body);
    if (bytes > maxBytes) {
      maxBytes = bytes;
      maxYear = year;
    }
    console.log(
      `Generated ${entries.length} talks for ${year}: ${(bytes / (1024 * 1024)).toFixed(2)} MB → ${outputFile}`,
    );
  }

  console.log(
    `Generated ${years.length} year shards (${totalTalks} talks). Max: ${maxYear} @ ${(maxBytes / (1024 * 1024)).toFixed(2)} MB`,
  );
}

generateShards();
