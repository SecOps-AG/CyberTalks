/** Shapes stored on disk under data/ and the richer shapes the app renders. */

/** data/events.json — one DEF CON. */
export type ConEvent = {
  slug: string;
  name: string;
  shortName: string;
  year: number;
  dates: string;
  location: string;
};

/** data/taxonomy.json */
export type Track = {
  slug: string;
  name: string;
  stance: "recon" | "offense" | "defense" | "both" | "domain";
  blurb: string;
};

export type Taxonomy = {
  notes: string[];
  tracks: Track[];
  topicLabels: Record<string, string>;
  topicAliases?: Record<string, string>;
};

export type TalkKind = "talk" | "clip" | "interview" | "announcement";

/** A talk exactly as authored in data/villages/<event>-<village>.json. */
export type StoredTalk = {
  youtubeId: string;
  slug: string;
  title: string;
  speakers: string[];
  track: string;
  topics: string[];
  teaser?: string;
  summary?: string | TalkSummary | null;
  durationSeconds?: number;
  publishedAt?: string;
  kind?: TalkKind;
};

/** One village at one event — the unit one ingest run produces. */
export type StoredVillageEdition = {
  villageSlug: string;
  villageName: string;
  eventSlug: string;
  playlistUrl: string;
  description: string;
  talks: StoredTalk[];
};

export type TalkSummary = {
  overview?: string;
  bullets?: string[];
  takeaways?: string[];
  [key: string]: unknown;
};

/** A village at one event, resolved against events.json. */
export type VillageEdition = {
  id: string;
  villageSlug: string;
  villageName: string;
  eventSlug: string;
  eventName: string;
  eventShortName: string;
  year: number;
  dates: string;
  location: string;
  playlistUrl: string;
  description: string;
  talkCount: number;
};

/** One village across every year it appears — "Recon Village", not "DC33 / Recon Village". */
export type VillageSeries = {
  slug: string;
  name: string;
  description: string;
  editions: VillageEdition[];
  talkCount: number;
  years: number[];
};

/** A talk with everything the UI needs, denormalised at load time. */
export type Talk = StoredTalk & {
  id: string;
  villageId: string;
  villageSlug: string;
  villageName: string;
  eventSlug: string;
  eventName: string;
  eventShortName: string;
  year: number;
  youtubeUrl: string;
  trackName: string;
  kind: TalkKind;
};

/**
 * The slim record shipped to the client for search and faceting.
 *
 * Excludes `summary` (kept in per-year shards). Teaser stays on the index so
 * cards can show it under the thumbnail. Search text is still derived client-side.
 */
export type TalkIndexEntry = {
  id: string;
  slug: string;
  title: string;
  teaser?: string;
  speakers: string[];
  youtubeId: string;
  year: number;
  eventSlug: string;
  eventShortName: string;
  villageSlug: string;
  villageName: string;
  track: string;
  trackName: string;
  topics: string[];
  durationSeconds?: number;
  kind: TalkKind;
};

/**
 * Derived, never stored: villages author `speakers` as plain names, and the
 * index groups them by slug. `name` is the spelling used by most of their
 * talks, so two spellings of one person collapse to a single page.
 */
export type Speaker = {
  slug: string;
  name: string;
  talkCount: number;
  yearsActive: number[];
  villages: string[];
  firstAppearance: number;
  lastAppearance: number;
  coSpeakers: string[];
};

/**
 * A wire entry plus its pre-lowercased search text. Built once on the client so
 * filtering never rebuilds strings per keystroke, and never sent over the wire.
 */
export type SearchEntry = TalkIndexEntry & {
  haystack: string;
  speakerSlugs: string[];
  matchedInSummary?: boolean;
};

/** Summary data for a single talk, fetched from per-year shards. */
export type TalkSummaryEntry = {
  id: string;
  summary?: string;
};

export type ArchiveStats = {
  talks: number;
  villages: number;
  events: number;
  tracks: number;
  topics: number;
  speakers: number;
};
