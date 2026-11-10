#!/usr/bin/env node
/**
 * Repair talks from YouTube-channel imports whose title is only the event
 * label ("USA 2001", "2020 Day 2") and whose year was taken from the upload
 * year of the channel rather than the event.
 *
 *   node scripts/fix-event-titles.mjs            # dry run, prints the report
 *   node scripts/fix-event-titles.mjs --apply    # rewrite data/villages/*.json
 *   node scripts/fix-event-titles.mjs --out <dir> --apply
 *
 * What it changes, and only on talks it can identify deterministically:
 *   - `year`        the 4-digit year named in the title, when it differs from
 *                   the channel's upload year (see StoredTalk.year).
 *   - `eventLabel`  the full edition name, e.g. "Black Hat USA 2001".
 *   - `title`       the real talk name, when the sole `speakers` entry is a
 *                   title segment and not a person. Then `speakers` is emptied.
 *   - `teaser`      dropped when it was generated from the event label (it
 *                   repeats the label); `enrichmentGaps.teaser` records why.
 * Slugs, youtubeId, summaries and good teasers are never touched.
 *
 * A title qualifies as "the event label" when it is only an optional short
 * label, a year, and an optional "Day N"/"Part N", AND the same label is
 * reused by several talks in that channel file (a one-off such as
 * "Pwnie Awards 2013" is a real title and is left alone). A title that is
 * only a year has no label and qualifies on its own.
 *
 * Second, year-only rule: a title with exactly one year whose text, with the
 * year masked, is reused by three or more talks across at least two different
 * years ("RSA Conference #### Keynote") is a templated series title. Only the
 * year is corrected there; the title is already the real one.
 *
 * Third, prefix rule: "BSidesSF 2023 - Defining a Data Masking Framework",
 * "JDD 2019: The Good, The Bad". The title opens with an edition tag (a short
 * label and a year) that three or more talks in the file share, across at
 * least two different years. The tag names the edition the talk was given at,
 * so `year` and `eventLabel` are set from it; the title is already the real
 * one and is left as it is.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, readEvents, readJson, villageFiles } from "./lib/util.mjs";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const outIndex = process.argv.indexOf("--out");
const OUT_DIR = outIndex === -1 ? null : process.argv[outIndex + 1];

const MIN_YEAR = 1990;
const MAX_YEAR = 2026;
const WORD = "[\\p{L}][\\p{L}\\p{N}'’.&®+#-]*";
const TITLE_RE = new RegExp(
  `^(?<label>(?:${WORD}\\s?){0,4}?)\\s*(?<year>(?:19[89]\\d|20[0-2]\\d))(?<suffix>\\s*[-–:]?\\s*(?:Day|Part)\\s*\\d+)?$`,
  "u",
);

/** Labels that only qualify the event ("USA 2001" at Black Hat), never name a talk. */
const QUALIFIERS = new Set([
  "usa",
  "eu",
  "europe",
  "asia",
  "windows",
  "japan",
  "north",
  "goa",
  "cali",
]);

function norm(value) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isChannelEdition(event, edition) {
  return (
    event.dates === String(event.year) &&
    /youtube\.com\/(channel\/|@)/.test(edition.playlistUrl ?? "")
  );
}

const events = new Map(readEvents().map((event) => [event.slug, event]));
const files = villageFiles().map((file) => ({ file, data: readJson(file) }));

// Given names seen as the first word of ordinary two or three word speaker
// strings in the well-parsed (non channel) files. Used only to decide whether
// a lone speaker string is a person, never to invent a name.
const firstWords = new Map();
for (const { data } of files) {
  const event = events.get(data.eventSlug);
  if (!event || isChannelEdition(event, data)) continue;
  for (const talk of data.talks) {
    for (const name of talk.speakers ?? []) {
      const words = name.trim().split(/\s+/);
      if (words.length < 2 || words.length > 3) continue;
      if (!words.every((word) => /^\p{Lu}[\p{L}'’.-]*$/u.test(word))) continue;
      const key = words[0].toLowerCase();
      firstWords.set(key, (firstWords.get(key) ?? 0) + 1);
    }
  }
}
const GIVEN = new Set([...firstWords].filter(([, count]) => count >= 6).map(([word]) => word));

function looksLikePerson(name) {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  if (/\([^)]*\)/.test(trimmed)) return true;
  if (/^(dr|prof|mr|mrs|ms)\.?$/i.test(words[0])) return true;
  return GIVEN.has(words[0].toLowerCase());
}

function parseTitle(title) {
  const match = TITLE_RE.exec(title.trim());
  if (!match) return null;
  const { label, year, suffix } = match.groups;
  return { label: label.trim(), year: Number(year), suffix: (suffix ?? "").trim() };
}

function editionLabel(event, title, label) {
  const bare = label === "" || QUALIFIERS.has(label.toLowerCase());
  return bare ? `${event.name} ${title.trim()}` : title.trim();
}

const PREFIX_RE = new RegExp(
  `^(?<tag>[^:|–—-]{0,40}?\\b(?<year>(?:19[89]\\d|20[0-2]\\d))\\b)(?=\\s*[-–—:|]|\\s)`,
  "u",
);
const YEAR_TOKEN = /(?<!\d)(?:19[89]\d|20[0-2]\d)(?!\d)/g;

const report = {
  generatedFrom: "scripts/fix-event-titles.mjs",
  files: [],
  counts: { inspectedChannelTalks: 0, labelTitles: 0, templateTitles: 0, prefixTitles: 0, yearChanged: 0, titleRecovered: 0, teaserDropped: 0 },
  leftAlone: { reusedLabelNoRecoverableTitle: 0, personSpeaker: 0, multipleSpeakers: 0, goodAlready: 0 },
  changes: [],
};

for (const entry of files) {
  const { file, data } = entry;
  const event = events.get(data.eventSlug);
  if (!event || !isChannelEdition(event, data)) continue;

  const parsed = data.talks.map((talk) => ({ talk, parsed: parseTitle(talk.title ?? "") }));
  const pairCount = new Map();
  const labelCount = new Map();
  for (const { parsed: p } of parsed) {
    if (!p) continue;
    const label = p.label.toLowerCase();
    pairCount.set(`${label}|${p.year}`, (pairCount.get(`${label}|${p.year}`) ?? 0) + 1);
    labelCount.set(label, (labelCount.get(label) ?? 0) + 1);
  }
  // A title that is only a year (or "YYYY Day N") cannot be a talk name, so it
  // qualifies even once. Titles with a label need the label to be reused.
  const qualifies = (p) =>
    p &&
    p.year >= MIN_YEAR &&
    p.year <= MAX_YEAR &&
    (p.label === "" ||
      (pairCount.get(`${p.label.toLowerCase()}|${p.year}`) ?? 0) >= 2 ||
      (labelCount.get(p.label.toLowerCase()) ?? 0) >= 3);

  const candidates = parsed.filter(({ parsed: p }) => qualifies(p));
  report.counts.inspectedChannelTalks += data.talks.length;
  report.counts.labelTitles += candidates.length;

  // A channel whose lone speaker strings are mostly people (AUSCERT "2020 Day 1"
  // with presenters) keeps its speakers; one whose strings are mostly not people
  // (Black Hat "USA 2001" with the session name) has the title in `speakers`.
  const singles = candidates.filter(({ talk }) => talk.speakers?.length === 1);
  const personShare =
    singles.length === 0
      ? 1
      : singles.filter(({ talk }) => looksLikePerson(talk.speakers[0])).length / singles.length;
  const speakerSegmentIsTitle = singles.length > 0 && personShare < 0.2;

  const fileReport = {
    file: path.basename(file),
    event: event.name,
    uploadYear: event.year,
    candidates: candidates.length,
    singleSpeaker: singles.length,
    personShare: Number(personShare.toFixed(2)),
    speakerSegmentIsTitle,
  };
  if (candidates.length > 0) report.files.push(fileReport);

  let touched = false;
  for (const { talk, parsed: p } of candidates) {
    const before = { title: talk.title, year: talk.year ?? event.year, speakers: talk.speakers ?? [], teaser: talk.teaser };
    const originalTitle = talk.title;
    const change = {};

    if (talk.year == null && p.year !== event.year) {
      talk.year = p.year;
      change.year = [event.year, p.year];
      report.counts.yearChanged += 1;
    }
    if (talk.eventLabel == null) {
      talk.eventLabel = editionLabel(event, originalTitle, p.label);
      change.eventLabel = talk.eventLabel;
    }

    const speakers = talk.speakers ?? [];
    let recovered = false;
    if (speakers.length === 1 && speakerSegmentIsTitle) {
      if (looksLikePerson(speakers[0])) {
        report.leftAlone.personSpeaker += 1;
      } else {
        talk.title = speakers[0].trim();
        talk.speakers = [];
        change.title = [originalTitle, talk.title];
        change.speakers = [before.speakers, []];
        report.counts.titleRecovered += 1;
        recovered = true;
      }
    } else if (speakers.length > 1) {
      report.leftAlone.multipleSpeakers += 1;
    } else if (speakers.length === 1) {
      report.leftAlone.personSpeaker += 1;
    }
    if (!recovered && speakers.length === 0) report.leftAlone.reusedLabelNoRecoverableTitle += 1;

    // A teaser that names the old label was generated from the swapped title.
    if (recovered && typeof talk.teaser === "string" && talk.teaser.includes(originalTitle)) {
      delete talk.teaser;
      const gaps = talk.enrichmentGaps ?? {};
      gaps.teaser = "Generated line repeated the event label; dropped when the real title was recovered.";
      talk.enrichmentGaps = gaps;
      change.teaser = [before.teaser, null];
      report.counts.teaserDropped += 1;
    }

    if (Object.keys(change).length > 0) {
      touched = true;
      report.changes.push({
        slug: talk.slug,
        file: path.basename(file),
        youtubeId: talk.youtubeId,
        beforeTitle: before.title,
        afterTitle: talk.title,
        beforeYear: before.year,
        afterYear: talk.year ?? event.year,
        beforeSpeakers: before.speakers,
        afterSpeakers: talk.speakers ?? [],
        eventLabel: talk.eventLabel,
        teaserDropped: Boolean(change.teaser),
      });
    }
  }

  // Year-only rule for templated series titles.
  const templates = new Map();
  for (const talk of data.talks) {
    const years = talk.title?.match(YEAR_TOKEN) ?? [];
    if (years.length !== 1) continue;
    const key = talk.title.replace(YEAR_TOKEN, "####");
    const list = templates.get(key) ?? [];
    list.push({ talk, year: Number(years[0]) });
    templates.set(key, list);
  }
  for (const list of templates.values()) {
    if (list.length < 3 || new Set(list.map((item) => item.year)).size < 2) continue;
    for (const { talk, year } of list) {
      if (talk.year != null || talk.eventLabel != null) continue;
      if (year === event.year || year < MIN_YEAR || year > MAX_YEAR) continue;
      talk.year = year;
      touched = true;
      report.counts.templateTitles += 1;
      report.counts.yearChanged += 1;
      report.changes.push({
        slug: talk.slug,
        file: path.basename(file),
        youtubeId: talk.youtubeId,
        beforeTitle: talk.title,
        afterTitle: talk.title,
        beforeYear: event.year,
        afterYear: year,
        beforeSpeakers: talk.speakers ?? [],
        afterSpeakers: talk.speakers ?? [],
        eventLabel: null,
        teaserDropped: false,
      });
    }
  }

  // Year (and region label) from a shared edition tag at the start of the title.
  const tags = new Map();
  for (const talk of data.talks) {
    const match = PREFIX_RE.exec(talk.title ?? "");
    if (!match) continue;
    const tag = match.groups.tag.trim();
    const mask = tag.replace(YEAR_TOKEN, "####").toLowerCase();
    const list = tags.get(mask) ?? [];
    list.push({ talk, tag, year: Number(match.groups.year), mask });
    tags.set(mask, list);
  }
  for (const list of tags.values()) {
    if (list.length < 3 || new Set(list.map((item) => item.year)).size < 2) continue;
    for (const { talk, tag, year, mask } of list) {
      if (talk.year != null || talk.eventLabel != null) continue;
      if (year === event.year || year < MIN_YEAR || year > MAX_YEAR) continue;
      talk.year = year;
      const change = { year: [event.year, year] };
      // "USA 2012" is only a region, so the event name goes in front of it; a
      // tag such as "BSidesSF 2023" or "4Developers 2021" already names the event.
      const region = mask.replace("####", "").trim();
      if (region !== "") {
        talk.eventLabel = QUALIFIERS.has(region) ? `${event.name} ${tag}` : tag;
        change.eventLabel = talk.eventLabel;
      }
      touched = true;
      report.counts.prefixTitles += 1;
      report.counts.yearChanged += 1;
      report.changes.push({
        slug: talk.slug,
        file: path.basename(file),
        youtubeId: talk.youtubeId,
        beforeTitle: talk.title,
        afterTitle: talk.title,
        beforeYear: event.year,
        afterYear: year,
        beforeSpeakers: talk.speakers ?? [],
        afterSpeakers: talk.speakers ?? [],
        eventLabel: talk.eventLabel ?? null,
        teaserDropped: false,
      });
    }
  }

  if (touched && APPLY) {
    const original = fs.readFileSync(file, "utf8");
    const text = `${JSON.stringify(data, null, 2)}\n`;
    const roundTrips = original === `${JSON.stringify(JSON.parse(original), null, 2)}\n`;
    if (!roundTrips) {
      throw new Error(`${path.basename(file)} does not round-trip through JSON.stringify; patch it by hand.`);
    }
    fs.writeFileSync(file, text);
  }
}

report.leftAlone.goodAlready = "see inspectedChannelTalks minus labelTitles (titles that are not an event label)";

if (OUT_DIR) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "event-title-fixes.json"), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ apply: APPLY, files: report.files, counts: report.counts, leftAlone: report.leftAlone }, null, 2));
