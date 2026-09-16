/**
 * Pure filtering/faceting used by both the server (for counts and static pages)
 * and the client browser component. No fs, no React — safe to import anywhere.
 */
import type { SearchEntry, Talk, TalkIndexEntry, TalkSummaryEntry } from "./types";

export const PAGE_SIZE = 24;

export type SortKey = "relevance" | "newest" | "duration" | "title" | "village";

export type LengthBucket = "under-20" | "20-45" | "45-plus";

export function formatDuration(seconds?: number): string | null {
  if (seconds == null || seconds <= 0 || !Number.isFinite(seconds)) return null;
  const mins = Math.round(seconds / 60);
  if (mins < 1) return "< 1 min";
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours} hr ${remMins} min` : `${hours} hr`;
  }
  return `${mins} min`;
}

export function getLengthBucket(durationSeconds?: number): LengthBucket | null {
  if (!durationSeconds || durationSeconds <= 0) return null;
  if (durationSeconds < 1200) return "under-20";
  if (durationSeconds <= 2700) return "20-45";
  return "45-plus";
}

/**
 * Speakers have no slug in data/ — the JSON carries display names only, so the
 * URL key is derived here. Accents fold rather than drop, so "Chloé" and
 * "Chloe" land on the same page. A name with nothing sluggable in it yields
 * "", and callers skip it rather than mint an empty route.
 */
export function slugifySpeaker(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
}

export type Filters = {
  q: string;
  years: number[];
  villages: string[];
  tracks: string[];
  topics: string[];
  speakers: string[];
  lengths: string[];
  includeExtras: boolean;
  sort: SortKey;
  page: number;
};

export const EMPTY_FILTERS: Filters = {
  q: "",
  years: [],
  villages: [],
  tracks: [],
  topics: [],
  speakers: [],
  lengths: [],
  includeExtras: false,
  sort: "relevance",
  page: 1,
};

export function buildIndexEntry(talk: Talk): TalkIndexEntry {
  return {
    id: talk.id,
    slug: talk.slug,
    title: talk.title,
    teaser: talk.teaser,
    speakers: talk.speakers,
    youtubeId: talk.youtubeId,
    year: talk.year,
    eventSlug: talk.eventSlug,
    eventShortName: talk.eventShortName,
    villageSlug: talk.villageSlug,
    villageName: talk.villageName,
    track: talk.track,
    trackName: talk.trackName,
    topics: talk.topics,
    durationSeconds: talk.durationSeconds,
    kind: talk.kind,
  };
}

/**
 * Derive the search text client-side. One pass over the index at mount costs a
 * few milliseconds; shipping it would roughly double the payload, since every
 * word in it is already present in the fields it is built from.
 *
 * Summary text is merged in later, fetched on-demand from per-year shards.
 */
export function withHaystack(entries: TalkIndexEntry[]): SearchEntry[] {
  return entries.map((entry) => ({
    ...entry,
    speakerSlugs: entry.speakers.map(slugifySpeaker),
    haystack: [
      entry.title,
      entry.teaser ?? "",
      entry.speakers.join(" "),
      entry.villageName,
      entry.eventShortName,
      entry.trackName,
      entry.topics.join(" "),
      entry.kind,
    ]
      .join(" ")
      .toLowerCase(),
  }));
}

/**
 * Merge summary data into search entries. Enriches haystack with summary text
 * and marks entries where the query matched the summary.
 */
export function mergeSummaries(
  entries: SearchEntry[],
  summaries: Map<string, string>,
  terms: string[],
): SearchEntry[] {
  if (terms.length === 0) return entries;

  return entries.map((entry) => {
    const summary = summaries.get(entry.id);
    if (!summary) return entry;

    const summaryLower = summary.toLowerCase();
    const matchedInSummary = terms.every((term) => summaryLower.includes(term));

    return {
      ...entry,
      haystack: entry.haystack + " " + summaryLower,
      matchedInSummary: matchedInSummary || undefined,
    };
  });
}

/** Every whitespace-separated term must appear somewhere in the entry. */
function matchesQuery(entry: SearchEntry, terms: string[]): boolean {
  return terms.every((term) => entry.haystack.includes(term));
}

export function queryTerms(q: string): string[] {
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

type Dimension = "q" | "years" | "villages" | "tracks" | "topics" | "speakers" | "lengths";

function matchesDimension(
  entry: SearchEntry,
  filters: Filters,
  terms: string[],
  skip: Dimension | null,
): boolean {
  if (skip !== "q" && terms.length > 0 && !matchesQuery(entry, terms)) return false;
  if (!filters.includeExtras && entry.kind !== "talk") return false;
  if (skip !== "years" && filters.years.length > 0 && !filters.years.includes(entry.year))
    return false;
  if (
    skip !== "lengths" &&
    filters.lengths.length > 0 &&
    (!entry.durationSeconds || !filters.lengths.includes(getLengthBucket(entry.durationSeconds) as string))
  )
    return false;
  if (
    skip !== "villages" &&
    filters.villages.length > 0 &&
    !filters.villages.includes(entry.villageSlug)
  )
    return false;
  if (skip !== "tracks" && filters.tracks.length > 0 && !filters.tracks.includes(entry.track))
    return false;
  // Topics are ANDed: each selected topic narrows further.
  if (
    skip !== "topics" &&
    filters.topics.length > 0 &&
    !filters.topics.every((topic) => entry.topics.includes(topic))
  )
    return false;
  // Speakers are ORed: picking two people means "talks by either of them".
  if (
    skip !== "speakers" &&
    filters.speakers.length > 0 &&
    !filters.speakers.some((speaker) => entry.speakerSlugs.includes(speaker))
  )
    return false;
  return true;
}

export function filterTalks(entries: SearchEntry[], filters: Filters): SearchEntry[] {
  const terms = queryTerms(filters.q);
  return entries.filter((entry) => matchesDimension(entry, filters, terms, null));
}

/** Cheap relevance: title hits beat teaser/speaker hits, then newest first. */
function relevanceScore(entry: SearchEntry, terms: string[]): number {
  if (terms.length === 0) return 0;
  const title = entry.title.toLowerCase();
  const speakers = entry.speakers.join(" ").toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (title.startsWith(term)) score += 6;
    else if (title.includes(term)) score += 4;
    if (speakers.includes(term)) score += 2;
    if (entry.topics.some((topic) => topic.includes(term))) score += 1;
  }
  return score;
}

export function sortTalks(
  entries: SearchEntry[],
  sort: SortKey,
  q: string,
): SearchEntry[] {
  const sorted = entries.slice();
  const terms = queryTerms(q);

  switch (sort) {
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "duration":
      return sorted.sort(
        (a, b) =>
          (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0) ||
          b.year - a.year ||
          a.title.localeCompare(b.title),
      );
    case "newest":
      return sorted.sort((a, b) => {
        const channelA = a.eventSlug === "defcon-channel" ? 1 : 0;
        const channelB = b.eventSlug === "defcon-channel" ? 1 : 0;
        if (channelA !== channelB) return channelA - channelB;
        return (
          b.year - a.year ||
          a.villageName.localeCompare(b.villageName) ||
          a.title.localeCompare(b.title)
        );
      });
    case "village":
      return sorted.sort(
        (a, b) =>
          a.villageName.localeCompare(b.villageName) || b.year - a.year ||
          a.title.localeCompare(b.title),
      );
    case "relevance":
    default:
      if (terms.length === 0) {
        return sorted.sort((a, b) => {
          const channelA = a.eventSlug === "defcon-channel" ? 1 : 0;
          const channelB = b.eventSlug === "defcon-channel" ? 1 : 0;
          if (channelA !== channelB) return channelA - channelB;
          return (
            b.year - a.year ||
            a.villageName.localeCompare(b.villageName) ||
            a.title.localeCompare(b.title)
          );
        });
      }
      return sorted.sort(
        (a, b) =>
          relevanceScore(b, terms) - relevanceScore(a, terms) || b.year - a.year ||
          a.title.localeCompare(b.title),
      );
  }
}

export type FacetOption<T extends string | number> = {
  value: T;
  label: string;
  count: number;
};

export type Facets = {
  years: FacetOption<number>[];
  villages: FacetOption<string>[];
  tracks: FacetOption<string>[];
  topics: FacetOption<string>[];
  speakers: FacetOption<string>[];
  lengths: FacetOption<string>[];
};

function tally<T extends string | number>(
  entries: SearchEntry[],
  pick: (entry: SearchEntry) => { value: T; label: string }[],
): Map<T, FacetOption<T>> {
  const counts = new Map<T, FacetOption<T>>();
  for (const entry of entries) {
    for (const { value, label } of pick(entry)) {
      const existing = counts.get(value);
      if (existing) existing.count += 1;
      else counts.set(value, { value, label, count: 1 });
    }
  }
  return counts;
}

/** The display name behind a slug, for a speaker filtered down to zero results. */
function speakerName(entries: SearchEntry[], slug: string): string {
  for (const entry of entries) {
    const index = entry.speakerSlugs.indexOf(slug);
    if (index >= 0) return entry.speakers[index];
  }
  return slug;
}

/**
 * Counts for each facet are computed against the results filtered by every
 * *other* facet, so the numbers say "what would I get if I also picked this"
 * instead of going stale the moment something is selected.
 */
export function computeFacets(entries: SearchEntry[], filters: Filters): Facets {
  const terms = queryTerms(filters.q);
  const subset = (skip: Dimension) =>
    entries.filter((entry) => matchesDimension(entry, filters, terms, skip));

  const years = [...tally(subset("years"), (e) => [{ value: e.year, label: String(e.year) }]).values()]
    .sort((a, b) => b.value - a.value);

  const villages = [
    ...tally(subset("villages"), (e) => [{ value: e.villageSlug, label: e.villageName }]).values(),
  ].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const tracks = [
    ...tally(subset("tracks"), (e) => [{ value: e.track, label: e.trackName }]).values(),
  ].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const topicSubset = subset("topics");
  const topicCounts = tally(topicSubset, (e) =>
    e.topics.map((topic) => ({ value: topic, label: topic })),
  );
  // A selected topic must stay visible even once it has narrowed the set to itself.
  for (const topic of filters.topics) {
    if (!topicCounts.has(topic)) topicCounts.set(topic, { value: topic, label: topic, count: 0 });
  }
  const topics = [...topicCounts.values()].sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value),
  );

  const speakerCounts = tally(subset("speakers"), (e) =>
    e.speakerSlugs.flatMap((slug, index) =>
      slug ? [{ value: slug, label: e.speakers[index] }] : [],
    ),
  );
  // Same as topics: a picked speaker stays listed once they are the whole set.
  for (const slug of filters.speakers) {
    if (speakerCounts.has(slug)) continue;
    speakerCounts.set(slug, { value: slug, label: speakerName(entries, slug), count: 0 });
  }
  const speakers = [...speakerCounts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );

  const lengthSubset = subset("lengths");
  const lengthCounts: Record<string, number> = {
    "under-20": 0,
    "20-45": 0,
    "45-plus": 0,
  };
  for (const entry of lengthSubset) {
    const bucket = getLengthBucket(entry.durationSeconds);
    if (bucket) {
      lengthCounts[bucket] = (lengthCounts[bucket] ?? 0) + 1;
    }
  }
  const lengths: FacetOption<string>[] = [
    { value: "under-20", label: "Under 20 min", count: lengthCounts["under-20"] },
    { value: "20-45", label: "20–45 min", count: lengthCounts["20-45"] },
    { value: "45-plus", label: "45+ min", count: lengthCounts["45-plus"] },
  ].filter((opt) => opt.count > 0 || filters.lengths.includes(opt.value));

  return { years, villages, tracks, topics, speakers, lengths };
}

export function countActive(filters: Filters): number {
  return (
    (filters.q.trim() ? 1 : 0) +
    filters.years.length +
    filters.villages.length +
    filters.tracks.length +
    filters.topics.length +
    filters.speakers.length +
    filters.lengths.length +
    (filters.includeExtras ? 1 : 0)
  );
}

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    totalPages,
    total: items.length,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
    items: items.slice(start, start + pageSize),
  };
}

/* ---------- URL <-> filter state ---------- */

/** URL key -> filter field. `speakers` is plural to match /speakers/<slug>. */
const LIST_KEYS = {
  year: "years",
  village: "villages",
  track: "tracks",
  topic: "topics",
  speakers: "speakers",
  length: "lengths",
} as const;

export function filtersFromParams(params: URLSearchParams): Filters {
  const list = (key: string) =>
    (params.get(key) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  const sort = params.get("sort") as SortKey | null;
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const validSorts: readonly SortKey[] = ["relevance", "newest", "duration", "title", "village"];

  return {
    q: params.get("q") ?? "",
    years: list("year")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value)),
    villages: list("village"),
    tracks: list("track"),
    topics: list("topic"),
    speakers: list("speakers"),
    lengths: list("length").filter((v) => ["under-20", "20-45", "45-plus"].includes(v)),
    includeExtras: params.get("extras") === "1" || params.get("extras") === "true",
    sort: validSorts.includes(sort as SortKey) ? (sort as SortKey) : "relevance",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function filtersToQuery(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  for (const [key, field] of Object.entries(LIST_KEYS) as [
    keyof typeof LIST_KEYS,
    (typeof LIST_KEYS)[keyof typeof LIST_KEYS],
  ][]) {
    const values = filters[field];
    if (values.length > 0) params.set(key, values.join(","));
  }
  if (filters.includeExtras) params.set("extras", "1");
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
