/** Shared limits for the build-time search index and the public API. */

export const SEARCH_INDEX_MAGIC = 0x49535443;
export const SEARCH_INDEX_VERSION = 1;
export const HEADER_BYTES = 128;

export const SEARCH_INDEX_BIN = "/search-index/index.bin";
export const SEARCH_INDEX_META = "/search-index/meta.json";

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 50;
export const MAX_PAGE = 200;
export const MAX_QUERY_LENGTH = 200;
export const MAX_TERMS = 8;
export const MAX_FILTER_VALUES = 8;
export const TOPIC_FACET_LIMIT = 24;

/** Per-isolate fixed window. Not a global Cloudflare rate-limit binding. */
export const RATE_LIMIT = 120;
export const RATE_WINDOW_MS = 60_000;

export const DIFFICULTY_INDEX = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
} as const;

export const DIFFICULTY_BY_INDEX = ["beginner", "intermediate", "advanced", "expert"] as const;

export const UNCLASSIFIED = 255;

export const HEADER_U32_FIELDS = [
  "docCount",
  "stringBytes",
  "stringCount",
  "speakerRefCount",
  "topicRefCount",
  "conferenceCount",
  "eventCount",
  "villageCount",
  "trackCount",
  "topicDictCount",
  "speakerDictCount",
  "tokenCount",
  "postingCount",
  "yearCount",
  "confFilterCount",
  "trackFilterCount",
  "difficultyCount",
  "topicFilterCount",
  "yearPostingCount",
  "confPostingCount",
  "trackPostingCount",
  "diffPostingCount",
  "topicPostingCount",
] as const;

export type HeaderField = (typeof HEADER_U32_FIELDS)[number];

export type IndexHeader = { version: number } & Record<HeaderField, number>;
