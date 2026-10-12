#!/usr/bin/env node

/**
 * Generate per-year (and per-conference) talk-index shards for client-side fetching.
 *
 * Mirrors TalkIndexEntry / buildIndexEntry (src/lib/search.ts) and the
 * denormalisation in getArchive (src/lib/data.ts).
 *
 * Writes:
 *   public/data/talk-index/manifest.json   → chunk manifest (years + per-year chunks)
 *   public/data/talk-index/years.json      → sorted number[] (legacy / thin clients)
 *   public/data/talk-index/talks-{year}.json → TalkIndexEntry[] (small years only)
 *   public/data/talk-index/talks-{year}-{conference}[-{part}].json → split busy years
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const DATA_DIR = path.join(projectRoot, "data");
const VILLAGE_DIR = path.join(DATA_DIR, "villages");
const OUTPUT_DIR = path.join(projectRoot, "public", "data", "talk-index");

/** Split a whole year when it exceeds either limit. */
const SPLIT_YEAR_MIN_TALKS = 3_000;
const SPLIT_YEAR_MIN_BYTES = 2.5 * 1024 * 1024;

/** Max size for a single chunk file (raw JSON bytes). */
const MAX_CHUNK_TALKS = 3_500;
const MAX_CHUNK_BYTES = 2.5 * 1024 * 1024;

/** Conferences smaller than this in a split year roll into one `misc` chunk. */
const MIN_CONF_GROUP = 150;

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

  for (const key of Object.keys(entry)) {
    if (entry[key] === undefined) delete entry[key];
  }
  return entry;
}

function chunkBodyBytes(entries) {
  return Buffer.byteLength(JSON.stringify(entries));
}

function splitEntries(entries, maxTalks, maxBytes) {
  if (
    entries.length <= maxTalks &&
    chunkBodyBytes(entries) <= maxBytes
  ) {
    return [entries];
  }

  const parts = [];
  let current = [];

  for (const entry of entries) {
    const next = [...current, entry];
    const wouldExceedTalks = next.length > maxTalks;
    const wouldExceedBytes =
      current.length > 0 && chunkBodyBytes(next) > maxBytes;

    if (wouldExceedTalks || wouldExceedBytes) {
      parts.push(current);
      current = [entry];
    } else {
      current = next;
    }
  }

  if (current.length > 0) parts.push(current);
  return parts;
}

function writeChunkFile(fileName, entries) {
  const outputFile = path.join(OUTPUT_DIR, fileName);
  const body = JSON.stringify(entries);
  fs.writeFileSync(outputFile, body);
  return Buffer.byteLength(body);
}

function groupByConference(entries) {
  const byConf = new Map();
  for (const entry of entries) {
    const conf = entry.conference;
    if (!byConf.has(conf)) byConf.set(conf, []);
    byConf.get(conf).push(entry);
  }
  return byConf;
}

function conferenceGroupsForSplitYear(entries) {
  const byConf = groupByConference(entries);
  const groups = [];
  let miscEntries = [];
  const miscConfs = [];

  for (const [conference, talks] of [...byConf.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    if (talks.length < MIN_CONF_GROUP) {
      miscEntries.push(...talks);
      miscConfs.push(conference);
    } else {
      groups.push({ slug: conference, conferences: [conference], entries: talks });
    }
  }

  if (miscEntries.length > 0) {
    groups.push({ slug: "misc", conferences: miscConfs.sort(), entries: miscEntries });
  }

  return groups;
}

function writeYearShards(year, entries, manifestChunks) {
  const yearBodyBytes = chunkBodyBytes(entries);
  const shouldSplit =
    entries.length > SPLIT_YEAR_MIN_TALKS ||
    yearBodyBytes > SPLIT_YEAR_MIN_BYTES;

  const yearChunks = [];

  if (!shouldSplit) {
    const file = `talks-${year}.json`;
    const bytes = writeChunkFile(file, entries);
    yearChunks.push({
      file,
      conferences: [...new Set(entries.map((e) => e.conference))].sort(),
      talks: entries.length,
      bytes,
      priority: 0,
    });
    manifestChunks[String(year)] = yearChunks;
    console.log(
      `  ${year}: ${entries.length} talks, single file ${(bytes / (1024 * 1024)).toFixed(2)} MB`,
    );
    return { maxBytes: bytes, maxFile: file };
  }

  const groups = conferenceGroupsForSplitYear(entries);
  let priority = 0;
  let maxBytes = 0;
  let maxFile = null;

  for (const group of groups) {
    const parts = splitEntries(group.entries, MAX_CHUNK_TALKS, MAX_CHUNK_BYTES);
    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      const part = parts[partIndex];
      const suffix =
        parts.length === 1 ? group.slug : `${group.slug}-${partIndex}`;
      const file = `talks-${year}-${suffix}.json`;
      const bytes = writeChunkFile(file, part);
      yearChunks.push({
        file,
        conferences: group.conferences,
        talks: part.length,
        bytes,
        priority,
      });
      priority += 1;
      if (bytes > maxBytes) {
        maxBytes = bytes;
        maxFile = file;
      }
      console.log(
        `  ${year}/${suffix}: ${part.length} talks, ${(bytes / (1024 * 1024)).toFixed(2)} MB → ${file}`,
      );
    }
  }

  // Highest talk-count chunks load first within the year.
  yearChunks.sort((a, b) => b.talks - a.talks);
  yearChunks.forEach((chunk, index) => {
    chunk.priority = index;
  });

  manifestChunks[String(year)] = yearChunks;
  return { maxBytes, maxFile };
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

  // Wipe stale shard files so removed years/chunks do not linger.
  for (const existing of fs.readdirSync(OUTPUT_DIR)) {
    if (
      existing === "years.json" ||
      existing === "manifest.json" ||
      /^talks-.*\.json$/.test(existing)
    ) {
      fs.unlinkSync(path.join(OUTPUT_DIR, existing));
    }
  }

  const years = [...shards.keys()].sort((a, b) => a - b);
  const manifestChunks = {};
  let globalMaxBytes = 0;
  let globalMaxFile = null;
  let totalTalks = 0;
  let totalChunks = 0;

  for (const year of years) {
    const entries = shards.get(year);
    totalTalks += entries.length;
    console.log(`Year ${year}: ${entries.length} talks`);
    const { maxBytes, maxFile } = writeYearShards(year, entries, manifestChunks);
    totalChunks += manifestChunks[String(year)].length;
    if (maxBytes > globalMaxBytes) {
      globalMaxBytes = maxBytes;
      globalMaxFile = maxFile;
    }
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "years.json"),
    JSON.stringify(years),
  );

  const manifest = {
    version: 1,
    years,
    chunks: manifestChunks,
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "manifest.json"),
    JSON.stringify(manifest),
  );

  console.log(
    `Generated ${years.length} years, ${totalChunks} chunks, ${totalTalks} talks.`,
  );
  console.log(
    `Largest chunk: ${globalMaxFile} @ ${(globalMaxBytes / (1024 * 1024)).toFixed(2)} MB raw`,
  );
}

generateShards();
