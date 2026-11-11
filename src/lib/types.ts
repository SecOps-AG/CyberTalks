/** Shapes stored on disk under data/ and the richer shapes the app renders. */

import type { MaterialLink } from "./materials";

export type { MaterialLink };

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

/**
 * How much background a talk assumes. Classified offline by talk-ingest.
 * There is no "unknown" level: an unclassified talk simply has no value.
 */
export type Difficulty = "beginner" | "intermediate" | "advanced" | "expert";

/** A talk exactly as authored in data/villages/<event>-<village>.json. */
export type StoredTalk = {
  youtubeId: string;
  slug: string;
  title: string;
  speakers: string[];
  /** Omitted when the catalog has no track for this talk. */
  track?: string;
  topics: string[];
  teaser?: string;
  summary?: string | TalkSummary | null;
  /** mp4 on the DEF CON media server when the talk has no YouTube player. */
  mediaUrl?: string | null;
  /** Site path of a stored poster, for talks that are not on YouTube. */
  thumbnail?: string | null;
  materials?: MaterialLink[];
  /** Why track, topics, or teaser were left empty. */
  enrichmentGaps?: Record<string, string>;
  durationSeconds?: number;
  publishedAt?: string;
  kind?: TalkKind;
  /** Spoken language, BCP 47 (e.g. "en", "de"). Falls back to the edition's. */
  language?: string;
  /** Normally joined in from data/view-counts.json; an inline value wins. */
  viewCount?: number;
  /** YouTube likes when known. Joined from data/view-counts.json; an inline value wins. */
  likeCount?: number;
  /** YouTube comments when the same fetch included them. */
  commentCount?: number;
  /** ISO timestamp the view count was read. */
  viewCountFetchedAt?: string;
  difficulty?: Difficulty;
  /**
   * Year the talk was given, when it differs from its event's year. Set only for
   * channel uploads whose event year is the upload year (see
   * scripts/fix-event-titles.mjs). Omitted on correctly dated talks.
   */
  year?: number;
  /** Edition name for titles and snippets, e.g. "Black Hat USA 2001". */
  eventLabel?: string;
};

/** One village at one event — the unit one ingest run produces. */
export type StoredVillageEdition = {
  villageSlug: string;
  villageName: string;
  eventSlug: string;
  /** Conference family slug, e.g. "defcon". Shared by every talk in this edition. */
  conference: string;
  /** Default spoken language for talks in this edition, BCP 47. */
  language?: string;
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
  conference: string;
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
  /** Empty when the catalog has no track. */
  track: string;
  villageId: string;
  villageSlug: string;
  villageName: string;
  eventSlug: string;
  conference: string;
  eventName: string;
  eventShortName: string;
  year: number;
  youtubeUrl: string;
  trackName: string;
  kind: TalkKind;
  /** Event month and year, e.g. "Aug 2025". */
  dateLabel: string;
  /** Event city (or "Online"), short enough for a chip. */
  locationLabel: string;
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
  conference: string;
  eventShortName: string;
  villageSlug: string;
  villageName: string;
  track: string;
  trackName: string;
  topics: string[];
  durationSeconds?: number;
  kind: TalkKind;
  dateLabel?: string;
  locationLabel?: string;
  language?: string;
  /** YouTube views when known; missing counts sort as 0. */
  viewCount?: number;
  /** YouTube likes when known. Used by the homepage's default first page. */
  likeCount?: number;
  /** Absent when the talk is unclassified. */
  difficulty?: Difficulty;
  /** Auto-band slides link. Absent when there isn't one. */
  hasSlides?: boolean;
  /** Auto-band repository link. Absent when there isn't one. */
  hasRepo?: boolean;
  /** Present when the talk links out to a media file instead of YouTube. */
  mediaUrl?: string;
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
  /** Lowercased title and speaker names, for relevance scoring. */
  titleLower?: string;
  speakersLower?: string;
  /** Lowercased summary text, once that year's summary shard has landed. */
  summaryLower?: string;
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
