/**
 * Query-string parser for /search and /api/v1/search.
 * Invalid input is a 400. A well-formed filter that matches nothing is not an error.
 */

import { DIFFICULTIES } from "../labels";
import type { Difficulty } from "../types";
import {
  DEFAULT_PAGE_SIZE,
  MAX_FILTER_VALUES,
  MAX_PAGE,
  MAX_PAGE_SIZE,
} from "./format";
import { tokensOf } from "./tokenize";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YEAR = /^\d{4}$/;

export type SearchQuery = {
  q: string;
  terms: string[];
  years: number[];
  conferences: string[];
  tracks: string[];
  topics: string[];
  difficulties: Difficulty[];
  sort: "relevance" | "newest";
  page: number;
  pageSize: number;
};

export type ParamError = {
  ok: false;
  status: 400;
  error: "invalid_request";
  field: string;
  message: string;
};

export type ParamOk = { ok: true; query: SearchQuery };

export type ParamResult = ParamOk | ParamError;

function fail(field: string, message: string): ParamError {
  return { ok: false, status: 400, error: "invalid_request", field, message };
}

export function valuesOf(params: URLSearchParams, key: string): string[] {
  const out: string[] = [];
  for (const raw of params.getAll(key)) {
    for (const part of raw.split(",")) {
      const value = part.trim();
      if (value) out.push(value);
    }
  }
  return out;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function slugs(
  params: URLSearchParams,
  key: string,
  label: string,
): { ok: true; values: string[] } | ParamError {
  const values = uniqueStrings(valuesOf(params, key).map((value) => value.toLowerCase()));
  if (values.length > MAX_FILTER_VALUES) {
    return fail(key, `Pass at most ${MAX_FILTER_VALUES} ${label}.`);
  }
  for (const value of values) {
    if (value.length > 80 || !SLUG.test(value)) {
      return fail(key, `${label[0].toUpperCase()}${label.slice(1)} must be a slug such as defcon or blue-team.`);
    }
  }
  return { ok: true, values };
}

export function searchParamsFromRecord(
  record: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") params.append(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    }
  }
  return params;
}

export function parseSearchParams(params: URLSearchParams): ParamResult {
  const q = (params.get("q") ?? "").trim();
  if (q.length > 200) return fail("q", "Query is too long.");
  if (/[\u0000-\u001f\u007f]/.test(q)) return fail("q", "Query contains unsupported characters.");

  const words = q ? q.split(/\s+/) : [];
  if (words.length > 8) return fail("q", "Use at most 8 words.");
  for (const word of words) {
    if (word.length > 64) return fail("q", "A search word is too long.");
  }

  const terms: string[] = [];
  const seenTerms = new Set<string>();
  for (const word of words) {
    for (const token of tokensOf(word)) {
      if (seenTerms.has(token)) continue;
      seenTerms.add(token);
      terms.push(token);
    }
  }
  if (q && terms.length === 0) {
    return fail(
      "q",
      'Query needs a word of at least 2 letters or digits. Common words such as "the" are ignored.',
    );
  }
  if (terms.length > 8) return fail("q", "Use at most 8 words.");

  const yearValues = uniqueStrings(valuesOf(params, "year"));
  if (yearValues.length > MAX_FILTER_VALUES) {
    return fail("year", `Pass at most ${MAX_FILTER_VALUES} years.`);
  }
  const years: number[] = [];
  for (const value of yearValues) {
    if (!YEAR.test(value)) return fail("year", "Year must be a four-digit year.");
    const year = Number(value);
    if (year < 1990 || year > 2100) return fail("year", "Year must be between 1990 and 2100.");
    years.push(year);
  }

  const conferences = slugs(params, "conference", "conferences");
  if (!conferences.ok) return conferences;
  const tracks = slugs(params, "track", "tracks");
  if (!tracks.ok) return tracks;
  const topics = slugs(params, "topic", "topics");
  if (!topics.ok) return topics;

  const difficultyValues = uniqueStrings(valuesOf(params, "difficulty").map((value) => value.toLowerCase()));
  if (difficultyValues.length > 4) return fail("difficulty", "Pass at most 4 difficulties.");
  const difficulties: Difficulty[] = [];
  for (const value of difficultyValues) {
    if (!DIFFICULTIES.includes(value as Difficulty)) {
      return fail(
        "difficulty",
        "Difficulty must be beginner, intermediate, advanced, or expert.",
      );
    }
    difficulties.push(value as Difficulty);
  }

  const sortRaw = (params.get("sort") ?? "").trim().toLowerCase();
  let sort: SearchQuery["sort"] = "relevance";
  if (sortRaw) {
    if (sortRaw !== "relevance" && sortRaw !== "newest") {
      return fail("sort", "Sort must be relevance or newest.");
    }
    sort = sortRaw;
  }

  const pageRaw = (params.get("page") ?? "").trim();
  let page = 1;
  if (pageRaw) {
    if (!/^\d+$/.test(pageRaw)) return fail("page", `Page must be an integer from 1 to ${MAX_PAGE}.`);
    page = Number(pageRaw);
    if (page < 1 || page > MAX_PAGE) {
      return fail("page", `Page must be an integer from 1 to ${MAX_PAGE}.`);
    }
  }

  const sizeRaw = (params.get("pageSize") ?? "").trim();
  let pageSize = DEFAULT_PAGE_SIZE;
  if (sizeRaw) {
    if (!/^\d+$/.test(sizeRaw)) {
      return fail("pageSize", `pageSize must be an integer from 1 to ${MAX_PAGE_SIZE}.`);
    }
    pageSize = Number(sizeRaw);
    if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      return fail("pageSize", `pageSize must be an integer from 1 to ${MAX_PAGE_SIZE}.`);
    }
  }

  return {
    ok: true,
    query: {
      q,
      terms,
      years,
      conferences: conferences.values,
      tracks: tracks.values,
      topics: topics.values,
      difficulties,
      sort,
      page,
      pageSize,
    },
  };
}

const TALK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,240}$/;

export function parseTalkId(id: string): ParamError | { ok: true; id: string } {
  if (!TALK_ID.test(id) || id.includes("..")) {
    return fail("id", "Talk id contains unsupported characters.");
  }
  return { ok: true, id };
}
