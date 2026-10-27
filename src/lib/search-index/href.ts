/**
 * Shareable /search URLs. Safe to import from client components: no index code.
 */

import type { Difficulty } from "../types";
import { DEFAULT_PAGE_SIZE } from "./format";
import type { SearchQuery } from "./params";

const DIFFICULTY_SET = new Set<string>(["beginner", "intermediate", "advanced", "expert"]);

function isDifficulty(value: string): value is Difficulty {
  return DIFFICULTY_SET.has(value);
}

export function hrefFromQuery(query: SearchQuery): string {
  const params = new URLSearchParams();
  if (query.q.trim()) params.set("q", query.q.trim());
  if (query.years.length > 0) params.set("year", query.years.join(","));
  if (query.conferences.length > 0) params.set("conference", query.conferences.join(","));
  if (query.tracks.length > 0) params.set("track", query.tracks.join(","));
  if (query.topics.length > 0) params.set("topic", query.topics.join(","));
  if (query.difficulties.length > 0) params.set("difficulty", query.difficulties.join(","));
  if (query.sort === "newest") params.set("sort", "newest");
  if (query.page > 1) params.set("page", String(query.page));
  if (query.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

/** Homepage search box → /search. Drops sorts the search page does not offer. */
export function archiveSearchHref(input: {
  q: string;
  years: readonly number[];
  conferences: readonly string[];
  tracks: readonly string[];
  topics: readonly string[];
  difficulties: readonly string[];
  sort: string;
}): string {
  return hrefFromQuery({
    q: input.q,
    terms: [],
    years: [...input.years],
    conferences: [...input.conferences],
    tracks: [...input.tracks],
    topics: [...input.topics],
    difficulties: input.difficulties.filter(isDifficulty),
    sort: input.sort === "newest" ? "newest" : "relevance",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
}

/** Bare /search and a single first-page query are indexable. Filters and later pages are not. */
export function isIndexableQuery(query: SearchQuery): boolean {
  return (
    query.page === 1 &&
    query.pageSize === DEFAULT_PAGE_SIZE &&
    query.sort === "relevance" &&
    query.years.length === 0 &&
    query.conferences.length === 0 &&
    query.tracks.length === 0 &&
    query.topics.length === 0 &&
    query.difficulties.length === 0
  );
}

export function canonicalPath(query: SearchQuery): string {
  if (isIndexableQuery(query)) return hrefFromQuery(query);
  return hrefFromQuery({
    ...query,
    years: [],
    conferences: [],
    tracks: [],
    topics: [],
    difficulties: [],
    sort: "relevance",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
}
