/**
 * Pure filtering/faceting used by both the server (for counts and static pages)
 * and the client browser component. No fs, no React — safe to import anywhere.
 */
import { DC34_EVENT_SLUG } from "./dc34";
import { inDefconVillage } from "./hubs";
import { conferenceLabel, DIFFICULTIES, difficultyLabel, normalizeDifficulty } from "./labels";
import { hasRepo, hasSlides, isYouTubeId } from "./materials";
import type { Difficulty, SearchEntry, Talk, TalkIndexEntry, TalkSummaryEntry } from "./types";

export const PAGE_SIZE = 24;

export type SortKey = "relevance" | "newest" | "views" | "duration" | "title" | "village";

export const SORT_KEYS: readonly SortKey[] = [
  "relevance",
  "newest",
  "views",
  "duration",
  "title",
  "village",
];

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
  conferences: string[];
  years: number[];
  villages: string[];
  tracks: string[];
  topics: string[];
  speakers: string[];
  lengths: string[];
  difficulties: Difficulty[];
  includeExtras: boolean;
  /** Auto-band slides only. */
  hasSlides: boolean;
  /** Auto-band repository only. */
  hasRepo: boolean;
  /** Media-archive recordings only: ids that are not YouTube videos. */
  notYouTube: boolean;
  sort: SortKey;
  page: number;
};

export const EMPTY_FILTERS: Filters = {
  q: "",
  conferences: [],
  years: [],
  villages: [],
  tracks: [],
  topics: [],
  speakers: [],
  lengths: [],
  difficulties: [],
  includeExtras: false,
  hasSlides: false,
  hasRepo: false,
  notYouTube: false,
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
    conference: talk.conference,
    eventShortName: talk.eventShortName,
    villageSlug: talk.villageSlug,
    villageName: talk.villageName,
    track: talk.track ?? "",
    trackName: talk.trackName,
    topics: talk.topics,
    durationSeconds: talk.durationSeconds,
    kind: talk.kind,
    dateLabel: talk.dateLabel,
    locationLabel: talk.locationLabel,
    language: talk.language,
    viewCount: talk.viewCount,
    ...(typeof talk.likeCount === "number" ? { likeCount: talk.likeCount } : {}),
    difficulty: normalizeDifficulty(talk.difficulty) ?? undefined,
    ...(hasSlides(talk.materials) ? { hasSlides: true as const } : {}),
    ...(hasRepo(talk.materials) ? { hasRepo: true as const } : {}),
    ...(talk.mediaUrl ? { mediaUrl: talk.mediaUrl } : {}),
  };
}

/**
 * Derive the search text client-side. Shipping it would roughly double the
 * payload, since every word in it is already present in the fields it is
 * built from.
 *
 * Results are cached per index entry object, so when the catalog grows one
 * shard at a time only the new talks are processed. Typing never comes back
 * here: the haystack depends on the talk, not on the query.
 */
const haystackCache = new WeakMap<TalkIndexEntry, SearchEntry>();

function toSearchEntry(entry: TalkIndexEntry): SearchEntry {
  const cached = haystackCache.get(entry);
  if (cached) return cached;
  const speakersLower = entry.speakers.join(" ").toLowerCase();
  const titleLower = entry.title.toLowerCase();
  const built: SearchEntry = {
    ...entry,
    speakerSlugs: entry.speakers.map(slugifySpeaker),
    titleLower,
    speakersLower,
    haystack: [
      titleLower,
      (entry.teaser ?? "").toLowerCase(),
      speakersLower,
      entry.villageName.toLowerCase(),
      entry.eventShortName.toLowerCase(),
      (entry.trackName ?? "").toLowerCase(),
      entry.topics.join(" ").toLowerCase(),
      entry.kind,
    ].join(" "),
  };
  haystackCache.set(entry, built);
  return built;
}

export function withHaystack(entries: TalkIndexEntry[]): SearchEntry[] {
  return entries.map(toSearchEntry);
}

/**
 * Fold summary text into the search text. Runs when a summary shard lands,
 * not per keystroke: the result only depends on which summaries are loaded.
 * Entries without a summary keep their object, so nothing is copied for them.
 */
export function withSummaries(
  entries: SearchEntry[],
  summaries: Map<string, string>,
): SearchEntry[] {
  if (summaries.size === 0) return entries;
  return entries.map((entry) => {
    const summary = summaries.get(entry.id);
    if (!summary) return entry;
    const summaryLower = summary.toLowerCase();
    return { ...entry, haystack: entry.haystack + " " + summaryLower, summaryLower };
  });
}

/**
 * Flag results whose summary holds every query term, for the "Matched in
 * summary" note. Only call it on the page being shown (24 cards), not the
 * whole catalog.
 */
export function markSummaryMatches(entries: SearchEntry[], q: string): SearchEntry[] {
  const terms = queryTerms(q);
  if (terms.length === 0) return entries;
  return entries.map((entry) =>
    entry.summaryLower && terms.every((term) => entry.summaryLower!.includes(term))
      ? { ...entry, matchedInSummary: true }
      : entry,
  );
}

/** Every whitespace-separated term must appear somewhere in the entry. */
function matchesQuery(entry: SearchEntry, terms: string[]): boolean {
  return terms.every((term) => entry.haystack.includes(term));
}

export function queryTerms(q: string): string[] {
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

type Dimension =
  | "q"
  | "conferences"
  | "years"
  | "villages"
  | "tracks"
  | "topics"
  | "speakers"
  | "lengths"
  | "difficulties";

function matchesDimension(
  entry: SearchEntry,
  filters: Filters,
  terms: string[],
  skip: Dimension | null,
): boolean {
  if (skip !== "q" && terms.length > 0 && !matchesQuery(entry, terms)) return false;
  if (!filters.includeExtras && entry.kind !== "talk") return false;
  if (
    skip !== "conferences" &&
    filters.conferences.length > 0 &&
    !filters.conferences.includes(entry.conference)
  )
    return false;
  if (skip !== "years" && filters.years.length > 0 && !filters.years.includes(entry.year))
    return false;
  if (
    skip !== "lengths" &&
    filters.lengths.length > 0 &&
    (!entry.durationSeconds || !filters.lengths.includes(getLengthBucket(entry.durationSeconds) as string))
  )
    return false;
  // Picking a level hides unclassified talks; there is no "unclassified" option.
  if (skip !== "difficulties" && filters.difficulties.length > 0) {
    const level = normalizeDifficulty(entry.difficulty);
    if (!level || !filters.difficulties.includes(level)) return false;
  }
  if (
    skip !== "villages" &&
    filters.villages.length > 0 &&
    (!inDefconVillage(entry) || !filters.villages.includes(entry.villageSlug))
  )
    return false;
  if (skip !== "tracks" && filters.tracks.length > 0 && !filters.tracks.includes(entry.track))
    return false;
  if (filters.hasSlides && !entry.hasSlides) return false;
  if (filters.hasRepo && !entry.hasRepo) return false;
  if (filters.notYouTube && isYouTubeId(entry.youtubeId)) return false;
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

/**
 * Talks that match the search text, honouring the extras toggle. Every other
 * filter and every facet count works from this list.
 */
export function matchText(
  entries: SearchEntry[],
  q: string,
  includeExtras: boolean,
): SearchEntry[] {
  const terms = queryTerms(q);
  if (terms.length === 0 && includeExtras) return entries;
  return entries.filter(
    (entry) =>
      (includeExtras || entry.kind === "talk") &&
      (terms.length === 0 || matchesQuery(entry, terms)),
  );
}

/**
 * True when every talk matching `next` also matches `previous`: each earlier
 * term is contained in some new term ("ransom" → "ransomware", or a word added).
 */
function narrowsQuery(previous: string[], next: string[]): boolean {
  return previous.every((term) => next.some((candidate) => candidate.includes(term)));
}

/**
 * `matchText` that remembers its last answer. Typing forward only narrows the
 * results, so the next keystroke scans the previous matches instead of the
 * whole catalog.
 */
export function createTextMatcher() {
  let last: {
    entries: SearchEntry[];
    terms: string[];
    includeExtras: boolean;
    result: SearchEntry[];
  } | null = null;
  return (entries: SearchEntry[], q: string, includeExtras: boolean): SearchEntry[] => {
    const terms = queryTerms(q);
    const reuse =
      last != null &&
      last.entries === entries &&
      last.includeExtras === includeExtras &&
      narrowsQuery(last.terms, terms);
    const source = reuse ? last!.result : entries;
    const result =
      reuse && terms.join(" ") === last!.terms.join(" ")
        ? last!.result
        : source === entries
          ? matchText(entries, q, includeExtras)
          : source.filter((entry) => terms.every((term) => entry.haystack.includes(term)));
    last = { entries, terms, includeExtras, result };
    return result;
  };
}

export function filterTalks(
  entries: SearchEntry[],
  filters: Filters,
  matched?: SearchEntry[],
): SearchEntry[] {
  const matching = matched ?? matchText(entries, filters.q, filters.includeExtras);
  return matching.filter((entry) => matchesDimension(entry, filters, [], "q"));
}

/** Cheap relevance: title hits beat teaser/speaker hits, then newest first. */
function relevanceScore(entry: SearchEntry, terms: string[]): number {
  if (terms.length === 0) return 0;
  const title = entry.titleLower ?? entry.title.toLowerCase();
  const speakers = entry.speakersLower ?? entry.speakers.join(" ").toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (title.startsWith(term)) score += 6;
    else if (title.includes(term)) score += 4;
    if (speakers.includes(term)) score += 2;
    if (entry.topics.some((topic) => topic.includes(term))) score += 1;
  }
  return score;
}

/**
 * Weight on likes per view in the homepage's default first page.
 * A typical 3% like rate adds 0.06, while 10x more views adds 1.
 */
export const DC34_LIKE_WEIGHT = 2;

/**
 * Homepage default score for one DEF CON 34 talk.
 * score = log10(viewCount + 1) + DC34_LIKE_WEIGHT * (likeCount / viewCount)
 * A viewCount of 0 contributes no like ratio. No viewCount means unscored.
 */
export function dc34PopularScore(entry: {
  viewCount?: number;
  likeCount?: number;
}): number | null {
  const views = entry.viewCount;
  if (typeof views !== "number" || !Number.isFinite(views) || views < 0) return null;
  const likes =
    typeof entry.likeCount === "number" && Number.isFinite(entry.likeCount) && entry.likeCount > 0
      ? entry.likeCount
      : 0;
  const ratio = views > 0 ? likes / views : 0;
  return Math.log10(views + 1) + DC34_LIKE_WEIGHT * ratio;
}

function compareDc34Popular(a: SearchEntry, b: SearchEntry): number {
  const scoreA = dc34PopularScore(a);
  const scoreB = dc34PopularScore(b);
  if (scoreA == null && scoreB == null) return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  if (scoreA == null) return 1;
  if (scoreB == null) return -1;
  return scoreB - scoreA || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

/**
 * First page of the default homepage: DEF CON 34 talks only, highest score
 * first. Talks with no viewCount go last within that set, so they stay off
 * the first page while any scored DEF CON 34 talk is still waiting.
 * Everything after that page keeps `entries` order, with the page-one talks
 * removed so they are not shown twice.
 */
function pinPopularDc34FirstPage(entries: SearchEntry[]): SearchEntry[] {
  const ranked = entries.filter((entry) => entry.eventSlug === DC34_EVENT_SLUG).sort(compareDc34Popular);
  const first = ranked.slice(0, PAGE_SIZE);
  if (first.length === 0) return entries;
  const pinned = new Set(first.map((entry) => entry.id));
  const rest = entries.filter((entry) => !pinned.has(entry.id));
  return first.concat(rest);
}

export function sortTalks(
  entries: SearchEntry[],
  sort: SortKey,
  q: string,
  options?: { pinPopularDc34?: boolean },
): SearchEntry[] {
  const sorted = entries.slice();
  const terms = queryTerms(q);

  switch (sort) {
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "views":
      return sorted.sort(
        (a, b) =>
          (b.viewCount ?? 0) - (a.viewCount ?? 0) ||
          b.year - a.year ||
          a.title.localeCompare(b.title),
      );
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
        sorted.sort((a, b) => {
          const channelA = a.eventSlug === "defcon-channel" ? 1 : 0;
          const channelB = b.eventSlug === "defcon-channel" ? 1 : 0;
          if (channelA !== channelB) return channelA - channelB;
          return (
            b.year - a.year ||
            a.villageName.localeCompare(b.villageName) ||
            a.title.localeCompare(b.title)
          );
        });
        return options?.pinPopularDc34 ? pinPopularDc34FirstPage(sorted) : sorted;
      }
      {
        // Score each talk once, not on every comparison inside the sort.
        const scores = new Map<SearchEntry, number>();
        for (const entry of sorted) scores.set(entry, relevanceScore(entry, terms));
        return sorted.sort(
          (a, b) =>
            scores.get(b)! - scores.get(a)! || b.year - a.year || a.title.localeCompare(b.title),
        );
      }
  }
}

export type FacetOption<T extends string | number> = {
  value: T;
  label: string;
  count: number;
};

export type Facets = {
  conferences: FacetOption<string>[];
  years: FacetOption<number>[];
  villages: FacetOption<string>[];
  tracks: FacetOption<string>[];
  topics: FacetOption<string>[];
  speakers: FacetOption<string>[];
  lengths: FacetOption<string>[];
  difficulties: FacetOption<Difficulty>[];
};

/** Counts values across entries. `pick` calls `add` once per value an entry carries. */
function tally<T extends string | number>(
  entries: SearchEntry[],
  pick: (entry: SearchEntry, add: (value: T, label: string) => void) => void,
): Map<T, FacetOption<T>> {
  const counts = new Map<T, FacetOption<T>>();
  const add = (value: T, label: string) => {
    const existing = counts.get(value);
    if (existing) existing.count += 1;
    else counts.set(value, { value, label, count: 1 });
  };
  for (const entry of entries) pick(entry, add);
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
export type FacetOptions = {
  /**
   * Homepage: always list beginner→expert even when nothing is classified yet
   * (counts may be 0). Other pages still hide empty levels unless selected.
   */
  alwaysShowDifficulties?: boolean;
};

const FACET_DIMENSIONS = [
  "conferences",
  "years",
  "villages",
  "tracks",
  "topics",
  "speakers",
  "lengths",
  "difficulties",
] as const;

/**
 * `matched` is `matchText(entries, filters.q, filters.includeExtras)` when the
 * caller already has it, so the search text is matched once per keystroke.
 */
export function computeFacets(
  entries: SearchEntry[],
  filters: Filters,
  options: FacetOptions = {},
  matched?: SearchEntry[],
): Facets {
  // The query is never a facet, so it is matched once up front and every facet
  // below scans only the talks that match the search text.
  const matching = matched ?? matchText(entries, filters.q, filters.includeExtras);
  // Skipping a facet nobody has picked from changes nothing, so those facets
  // share one filtered list. Only facets with picks need their own pass.
  const narrowed = matching.filter((entry) => matchesDimension(entry, filters, [], "q"));
  const picked = new Set<Dimension>(
    FACET_DIMENSIONS.filter((dimension) => filters[dimension].length > 0),
  );
  const subset = (skip: Dimension) =>
    picked.has(skip)
      ? matching.filter((entry) => matchesDimension(entry, filters, [], skip))
      : narrowed;

  const conferences = [
    ...tally<string>(subset("conferences"), (e, add) =>
      add(e.conference, conferenceLabel(e.conference)),
    ).values(),
  ].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const years = [...tally<number>(subset("years"), (e, add) => add(e.year, String(e.year))).values()]
    .sort((a, b) => b.value - a.value);

  const villages = [
    ...tally<string>(subset("villages"), (e, add) => {
      if (inDefconVillage(e)) add(e.villageSlug, e.villageName);
    }).values(),
  ].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const tracks = [
    ...tally<string>(subset("tracks"), (e, add) => {
      if (e.track) add(e.track, e.trackName || e.track);
    }).values(),
  ].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const topicSubset = subset("topics");
  const topicCounts = tally<string>(topicSubset, (e, add) => {
    for (const topic of e.topics) add(topic, topic);
  });
  // A selected topic must stay visible even once it has narrowed the set to itself.
  for (const topic of filters.topics) {
    if (!topicCounts.has(topic)) topicCounts.set(topic, { value: topic, label: topic, count: 0 });
  }
  const topics = [...topicCounts.values()].sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value),
  );

  const speakerCounts = tally<string>(subset("speakers"), (e, add) => {
    e.speakerSlugs.forEach((slug, index) => {
      if (slug) add(slug, e.speakers[index]);
    });
  });
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

  // Only classified talks are counted, in fixed easiest-to-hardest order.
  // Unclassified talks have no difficulty field and are not implied by a 0 count.
  const difficultyCounts = tally<Difficulty>(subset("difficulties"), (e, add) => {
    const level = normalizeDifficulty(e.difficulty);
    if (level) add(level, difficultyLabel(level));
  });
  const difficulties: FacetOption<Difficulty>[] = DIFFICULTIES.map((level) => ({
    value: level,
    label: difficultyLabel(level),
    count: difficultyCounts.get(level)?.count ?? 0,
  })).filter(
    (opt) =>
      options.alwaysShowDifficulties ||
      opt.count > 0 ||
      filters.difficulties.includes(opt.value),
  );

  return { conferences, years, villages, tracks, topics, speakers, lengths, difficulties };
}

export function countActive(filters: Filters): number {
  return (
    (filters.q.trim() ? 1 : 0) +
    filters.conferences.length +
    filters.years.length +
    filters.villages.length +
    filters.tracks.length +
    filters.topics.length +
    filters.speakers.length +
    filters.lengths.length +
    filters.difficulties.length +
    (filters.includeExtras ? 1 : 0) +
    (filters.hasSlides ? 1 : 0) +
    (filters.hasRepo ? 1 : 0) +
    (filters.notYouTube ? 1 : 0)
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

function stripSearchFields(entry: SearchEntry): TalkIndexEntry {
  const { haystack, speakerSlugs, titleLower, speakersLower, summaryLower, matchedInSummary, ...talk } =
    entry;
  void haystack;
  void speakerSlugs;
  void titleLower;
  void speakersLower;
  void summaryLower;
  void matchedInSummary;
  return talk;
}

/**
 * First page of the default browse (relevance, extras hidden). Listing pages
 * SSR this slice and fetch the rest, so the document does not carry every talk.
 */
export function initialBrowsePage(
  talks: TalkIndexEntry[],
  options?: { pinPopularDc34?: boolean },
): {
  talks: TalkIndexEntry[];
  total: number;
} {
  const searchable = withHaystack(talks);
  let filtered = filterTalks(searchable, EMPTY_FILTERS);
  // Extras (clips, interviews, announcements) are hidden by default. A list made
  // only of extras still has to show them, or the page reads "0 talks".
  if (filtered.length === 0 && talks.length > 0) {
    filtered = filterTalks(searchable, { ...EMPTY_FILTERS, includeExtras: true });
  }
  const sorted = sortTalks(filtered, "relevance", "", options);
  return {
    talks: paginate(sorted, 1).items.map(stripSearchFields),
    total: filtered.length,
  };
}

/** Longest topic / speaker list sent ahead of the full listing. */
export const INITIAL_FACET_LIMIT = 40;

/**
 * First page plus the default-browse facet counts, so a listing page can draw
 * its filter rail from the document and leave the full talk list unfetched
 * until someone uses a control. Topic and speaker options are the commonest
 * few: they are long tails, and the type-ahead only needs the whole set once
 * the listing has loaded.
 */
export function initialBrowse(
  talks: TalkIndexEntry[],
  options?: { pinPopularDc34?: boolean },
): {
  talks: TalkIndexEntry[];
  total: number;
  facets: Facets;
} {
  const entries = withHaystack(talks);
  const filtered = filterTalks(entries, EMPTY_FILTERS);
  const sorted = sortTalks(filtered, "relevance", "", options);
  const everyExtra = talks.length > 0 && talks.every((talk) => talk.kind !== "talk");
  const facets = computeFacets(entries, { ...EMPTY_FILTERS, includeExtras: everyExtra });
  return {
    talks: paginate(sorted, 1).items.map(stripSearchFields),
    total: filtered.length,
    facets: {
      ...facets,
      topics: facets.topics.slice(0, INITIAL_FACET_LIMIT),
      speakers: facets.speakers.slice(0, INITIAL_FACET_LIMIT),
    },
  };
}

/* ---------- URL <-> filter state ---------- */

/** URL key -> filter field. `speakers` is plural to match /speakers/<slug>. */
const LIST_KEYS = {
  conference: "conferences",
  year: "years",
  village: "villages",
  track: "tracks",
  topic: "topics",
  speakers: "speakers",
  length: "lengths",
  difficulty: "difficulties",
} as const;

export function filtersFromParams(params: URLSearchParams): Filters {
  const list = (key: string) =>
    (params.get(key) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  const sort = params.get("sort") as SortKey | null;
  const page = Number.parseInt(params.get("page") ?? "1", 10);

  return {
    q: params.get("q") ?? "",
    conferences: list("conference"),
    years: list("year")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value)),
    villages: list("village"),
    tracks: list("track"),
    topics: list("topic"),
    speakers: list("speakers"),
    lengths: list("length").filter((v) => ["under-20", "20-45", "45-plus"].includes(v)),
    difficulties: list("difficulty").filter((v): v is Difficulty =>
      DIFFICULTIES.includes(v as Difficulty),
    ),
    includeExtras: params.get("extras") === "1" || params.get("extras") === "true",
    hasSlides: params.get("slides") === "1",
    hasRepo: params.get("repo") === "1",
    notYouTube: params.get("notyoutube") === "1",
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : "relevance",
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
  if (filters.hasSlides) params.set("slides", "1");
  if (filters.hasRepo) params.set("repo", "1");
  if (filters.notYouTube) params.set("notyoutube", "1");
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
