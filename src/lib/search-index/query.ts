/**
 * Filter, score, and facet over the compact index.
 * Posting lists stay sorted by document id and are never mutated.
 */

import { difficultyLabel } from "../labels";
import { topicLabel } from "../topic-labels";
import type { Difficulty } from "../types";
import { readString, type RuntimeIndex } from "./decode";
import { DIFFICULTY_BY_INDEX, DIFFICULTY_INDEX, TOPIC_FACET_LIMIT, UNCLASSIFIED } from "./format";
import { fnv1a64 } from "./hash";
import type { Facet, SearchFacets, SearchMeta, SearchResponse, TalkDetail, TalkHit, YearFacet } from "./model";
import type { SearchQuery } from "./params";

type Scored = { ids: Uint32Array; scores: Uint8Array | null };
type TextHit = Scored | null | "none";
type Group = { name: string; ids: Uint32Array };

const EMPTY = new Uint32Array();

function slice(all: Uint32Array, start: number, count: number): Uint32Array {
  if (count <= 0) return EMPTY;
  return all.subarray(start, start + count);
}

function findToken(index: RuntimeIndex, token: string): { start: number; count: number } | null {
  let lo = 0;
  let hi = index.tokenSid.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const value = readString(index, index.tokenSid[mid]);
    if (value === token) return { start: index.tokenStart[mid], count: index.tokenCount[mid] };
    if (value < token) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

function findTopic(index: RuntimeIndex, slug: string): number | null {
  let lo = 0;
  let hi = index.topicSlugSid.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const value = readString(index, index.topicSlugSid[mid]);
    if (value === slug) return mid;
    if (value < slug) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

function intersectIds(left: Uint32Array, right: Uint32Array): Uint32Array {
  const out = new Uint32Array(Math.min(left.length, right.length));
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < left.length && j < right.length) {
    const a = left[i];
    const b = right[j];
    if (a === b) {
      out[k++] = a;
      i += 1;
      j += 1;
    } else if (a < b) i += 1;
    else j += 1;
  }
  return out.subarray(0, k);
}

function intersectScored(
  leftIds: Uint32Array,
  leftScores: Uint8Array | null,
  right: Uint32Array,
): Scored {
  const outIds = new Uint32Array(Math.min(leftIds.length, right.length));
  const outScores = leftScores ? new Uint8Array(outIds.length) : null;
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < leftIds.length && j < right.length) {
    const a = leftIds[i];
    const b = right[j];
    if (a === b) {
      outIds[k] = a;
      if (outScores && leftScores) outScores[k] = leftScores[i];
      k += 1;
      i += 1;
      j += 1;
    } else if (a < b) i += 1;
    else j += 1;
  }
  return { ids: outIds.subarray(0, k), scores: outScores ? outScores.subarray(0, k) : null };
}

function unionTwo(left: Uint32Array, right: Uint32Array): Uint32Array {
  const out = new Uint32Array(left.length + right.length);
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < left.length && j < right.length) {
    const a = left[i];
    const b = right[j];
    if (a === b) {
      out[k++] = a;
      i += 1;
      j += 1;
    } else if (a < b) out[k++] = left[i++];
    else out[k++] = right[j++];
  }
  while (i < left.length) out[k++] = left[i++];
  while (j < right.length) out[k++] = right[j++];
  return out.subarray(0, k);
}

function unionAll(lists: Uint32Array[]): Uint32Array {
  const present = lists.filter((list) => list.length > 0);
  if (present.length === 0) return EMPTY;
  let acc = present[0];
  for (let i = 1; i < present.length; i++) acc = unionTwo(acc, present[i]);
  return acc;
}

function yearPosting(index: RuntimeIndex, year: number): Uint32Array {
  for (let i = 0; i < index.yearValue.length; i++) {
    if (index.yearValue[i] === year) return slice(index.yearPostings, index.yearStart[i], index.yearCount[i]);
  }
  return EMPTY;
}

function dictPosting(
  rows: { slug: string }[],
  slug: string,
  postings: Uint32Array,
  start: Uint32Array,
  count: Uint32Array,
): Uint32Array {
  const index = rows.findIndex((row) => row.slug === slug);
  if (index < 0) return EMPTY;
  return slice(postings, start[index], count[index]);
}

function topicPosting(index: RuntimeIndex, slug: string): Uint32Array {
  const found = findTopic(index, slug);
  if (found == null) return EMPTY;
  return slice(index.topicPostings, index.topicPostStart[found], index.topicPostCount[found]);
}

function diffPosting(index: RuntimeIndex, level: Difficulty): Uint32Array {
  const slot = DIFFICULTY_INDEX[level];
  return slice(index.diffPostings, index.diffStart[slot], index.diffCount[slot]);
}

function matchText(index: RuntimeIndex, terms: readonly string[]): TextHit {
  if (terms.length === 0) return null;
  let ids: Uint32Array | null = null;
  let scores: Uint8Array | null = null;
  for (const term of terms) {
    const found = findToken(index, term);
    if (!found || found.count === 0) return "none";
    const termIds = slice(index.postings, found.start, found.count);
    const termScores = index.scores.subarray(found.start, found.start + found.count);
    if (!ids || !scores) {
      ids = termIds;
      scores = termScores;
    } else {
      const merged = intersectScored(ids, scores, termIds);
      // Second list's scores are added by walking both — intersectScored only keeps left scores.
      // Add the right-hand score for the surviving docs.
      ids = merged.ids;
      scores = addRightScores(merged.ids, merged.scores, termIds, termScores);
      if (ids.length === 0) return "none";
    }
  }
  return { ids: ids!, scores: scores! };
}

function addRightScores(
  ids: Uint32Array,
  leftScores: Uint8Array | null,
  rightIds: Uint32Array,
  rightScores: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(ids.length);
  let j = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    while (j < rightIds.length && rightIds[j] < id) j += 1;
    const extra = j < rightIds.length && rightIds[j] === id ? rightScores[j] : 0;
    const base = leftScores ? leftScores[i] : 0;
    const sum = base + extra;
    out[i] = sum > 255 ? 255 : sum;
  }
  return out;
}

function filterGroups(index: RuntimeIndex, query: SearchQuery): Group[] {
  const groups: Group[] = [];
  if (query.years.length > 0) {
    groups.push({ name: "years", ids: unionAll(query.years.map((year) => yearPosting(index, year))) });
  }
  if (query.conferences.length > 0) {
    groups.push({
      name: "conferences",
      ids: unionAll(
        query.conferences.map((slug) =>
          dictPosting(index.conferences, slug, index.confPostings, index.confStart, index.confCount),
        ),
      ),
    });
  }
  if (query.tracks.length > 0) {
    groups.push({
      name: "tracks",
      ids: unionAll(
        query.tracks.map((slug) =>
          dictPosting(index.tracks, slug, index.trackPostings, index.trackStart, index.trackCount),
        ),
      ),
    });
  }
  if (query.difficulties.length > 0) {
    groups.push({
      name: "difficulties",
      ids: unionAll(query.difficulties.map((level) => diffPosting(index, level))),
    });
  }
  query.topics.forEach((topic, topicIndex) => {
    groups.push({ name: `topic:${topicIndex}`, ids: topicPosting(index, topic) });
  });
  return groups;
}

function applyFilters(text: TextHit, groups: readonly Group[]): Scored | "all" | "empty" {
  if (text === "none") return "empty";
  let ids: Uint32Array | null = text ? text.ids : null;
  let scores: Uint8Array | null = text ? text.scores : null;
  for (const group of groups) {
    if (group.ids.length === 0) return "empty";
    if (ids == null) {
      ids = group.ids;
      scores = null;
    } else {
      const next = intersectScored(ids, scores, group.ids);
      ids = next.ids;
      scores = next.scores;
    }
    if (ids.length === 0) return "empty";
  }
  if (ids == null) return "all";
  return { ids, scores };
}

function poolFor(text: TextHit, groups: readonly Group[], skip: string | null): Uint32Array | "all" {
  if (text === "none") return EMPTY;
  let current: Uint32Array | null = text ? text.ids : null;
  for (const group of groups) {
    const skipped = skip === "topics" ? group.name.startsWith("topic:") : group.name === skip;
    if (skipped) continue;
    if (group.ids.length === 0) return EMPTY;
    current = current == null ? group.ids : intersectIds(current, group.ids);
    if (current.length === 0) return current;
  }
  return current == null ? "all" : current;
}

function ensureYears(facets: readonly YearFacet[], selected: readonly number[]): YearFacet[] {
  const seen = new Set(facets.map((facet) => facet.value));
  const extra = selected
    .filter((year) => !seen.has(year))
    .map((year) => ({ value: year, label: String(year), count: 0 }));
  return [...facets, ...extra].sort((a, b) => b.value - a.value);
}

function ensureValues(
  facets: readonly Facet[],
  selected: readonly string[],
  labelFor: (value: string) => string,
): Facet[] {
  const seen = new Set(facets.map((facet) => facet.value));
  const extra = selected
    .filter((value) => !seen.has(value))
    .map((value) => ({ value, label: labelFor(value), count: 0 }));
  return [...facets, ...extra];
}

function tallyYears(index: RuntimeIndex, ids: Uint32Array): YearFacet[] {
  const counts = new Map<number, number>();
  for (const id of ids) counts.set(index.year[id], (counts.get(index.year[id]) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: String(value), count }))
    .sort((a, b) => b.value - a.value);
}

function tallyDict(
  ids: Uint32Array,
  pick: (id: number) => number,
  rows: readonly { slug: string; label?: string; name?: string }[],
): Facet[] {
  const counts = new Uint32Array(rows.length);
  for (const id of ids) counts[pick(id)] += 1;
  const facets: Facet[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (counts[i] === 0) continue;
    const row = rows[i];
    facets.push({ value: row.slug, label: row.label ?? row.name ?? row.slug, count: counts[i] });
  }
  facets.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return facets;
}

function tallyDifficulties(index: RuntimeIndex, ids: Uint32Array): Facet[] {
  const counts = [0, 0, 0, 0];
  for (const id of ids) {
    const level = index.difficulty[id];
    if (level !== UNCLASSIFIED && level < 4) counts[level] += 1;
  }
  return DIFFICULTY_BY_INDEX.map((value, slot) => ({
    value,
    label: difficultyLabel(value),
    count: counts[slot],
  }));
}

function topicFacet(index: RuntimeIndex, topicIndex: number, count: number): Facet {
  return {
    value: readString(index, index.topicSlugSid[topicIndex]),
    label: readString(index, index.topicLabelSid[topicIndex]),
    count,
  };
}

function tallyTopics(
  index: RuntimeIndex,
  ids: Uint32Array,
  selected: readonly string[],
): Pick<SearchFacets, "topics" | "topicsTruncated" | "topicTotal"> {
  const counts = new Map<number, number>();
  for (const id of ids) {
    const start = index.topicStart[id];
    const count = index.topicCount[id];
    for (let n = 0; n < count; n++) {
      const topic = index.topicRefs[start + n];
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const head = ranked.slice(0, TOPIC_FACET_LIMIT);
  const chosen = new Set(head.map(([topic]) => topic));
  for (const slug of selected) {
    const found = findTopic(index, slug);
    if (found == null || chosen.has(found)) continue;
    head.push([found, counts.get(found) ?? 0]);
    chosen.add(found);
  }
  const topics = head.map(([topic, count]) => topicFacet(index, topic, count));
  for (const slug of selected) {
    if (!topics.some((topic) => topic.value === slug)) {
      topics.push({ value: slug, label: topicLabel(slug), count: 0 });
    }
  }
  return {
    topics,
    topicTotal: counts.size,
    topicsTruncated: ranked.length > TOPIC_FACET_LIMIT,
  };
}

function topicsFromMeta(
  index: RuntimeIndex,
  meta: SearchMeta,
  selected: readonly string[],
): Pick<SearchFacets, "topics" | "topicsTruncated" | "topicTotal"> {
  const topics = meta.topicsTop.map((topic) => ({ ...topic }));
  const seen = new Set(topics.map((topic) => topic.value));
  for (const slug of selected) {
    if (seen.has(slug)) continue;
    const found = findTopic(index, slug);
    topics.push(
      found == null
        ? { value: slug, label: topicLabel(slug), count: 0 }
        : topicFacet(index, found, index.topicPostCount[found]),
    );
    seen.add(slug);
  }
  return {
    topics,
    topicTotal: meta.topicTotal,
    topicsTruncated: meta.topicTotal > meta.topicsTop.length,
  };
}

function buildFacets(
  index: RuntimeIndex,
  query: SearchQuery,
  text: TextHit,
  groups: readonly Group[],
  meta: SearchMeta | null,
): SearchFacets {
  const yearPool = poolFor(text, groups, "years");
  const conferencePool = poolFor(text, groups, "conferences");
  const trackPool = poolFor(text, groups, "tracks");
  const difficultyPool = poolFor(text, groups, "difficulties");
  // Topic counts ignore topic filters, same as the on-site facet: each count is
  // "talks you would see if this were the topic selection".
  const topicBase = poolFor(text, groups, "topics");

  const years = ensureYears(
    yearPool === "all" && meta ? meta.years : tallyYears(index, yearPool === "all" ? index.newestOrder : yearPool),
    query.years,
  );
  const conferences = ensureValues(
    conferencePool === "all" && meta
      ? meta.conferences
      : tallyDict(conferencePool === "all" ? index.newestOrder : conferencePool, (id) => index.conference[id], index.conferences),
    query.conferences,
    (slug) => index.conferences.find((row) => row.slug === slug)?.label ?? slug,
  );
  const tracks = ensureValues(
    trackPool === "all" && meta
      ? meta.tracks
      : tallyDict(trackPool === "all" ? index.newestOrder : trackPool, (id) => index.track[id], index.tracks),
    query.tracks,
    (slug) => index.tracks.find((row) => row.slug === slug)?.name ?? slug,
  );
  const difficulties =
    difficultyPool === "all" && meta
      ? meta.difficulties.map((facet) => ({ ...facet }))
      : tallyDifficulties(index, difficultyPool === "all" ? index.newestOrder : difficultyPool);

  const topicFacets =
    topicBase === "all" && meta
      ? topicsFromMeta(index, meta, query.topics)
      : tallyTopics(index, topicBase === "all" ? index.newestOrder : topicBase, query.topics);

  return { years, conferences, tracks, difficulties, ...topicFacets };
}

function pageDocs(index: RuntimeIndex, scored: Scored, query: SearchQuery): number[] {
  const start = (query.page - 1) * query.pageSize;
  if (start >= scored.ids.length) return [];
  const end = Math.min(start + query.pageSize, scored.ids.length);
  if (query.sort !== "relevance" || !scored.scores) {
    if (scored.ids.length > 4096) return pageByNewestScan(index, scored.ids, start, end);
  }
  const order = new Uint32Array(scored.ids.length);
  for (let i = 0; i < order.length; i++) order[i] = i;
  const rank = index.newestRank;
  const ids = scored.ids;
  const scores = scored.scores;
  if (query.sort === "relevance" && scores) {
    order.sort((i, j) => scores[j] - scores[i] || rank[ids[i]] - rank[ids[j]] || ids[i] - ids[j]);
  } else {
    order.sort((i, j) => rank[ids[i]] - rank[ids[j]] || ids[i] - ids[j]);
  }
  const page: number[] = [];
  for (let n = start; n < end; n++) page.push(ids[order[n]]);
  return page;
}

function pageByNewestScan(index: RuntimeIndex, ids: Uint32Array, start: number, end: number): number[] {
  const want = new Set<number>();
  for (const id of ids) want.add(id);
  const page: number[] = [];
  let seen = 0;
  for (const docId of index.newestOrder) {
    if (!want.has(docId)) continue;
    if (seen >= start) page.push(docId);
    seen += 1;
    if (seen >= end) break;
  }
  return page;
}

function materialize(index: RuntimeIndex, docId: number, origin: string): TalkHit {
  const speakers: string[] = [];
  const speakerFrom = index.speakerStart[docId];
  for (let n = 0; n < index.speakerCount[docId]; n++) {
    speakers.push(readString(index, index.speakerNameSid[index.speakerRefs[speakerFrom + n]]));
  }
  const topics: string[] = [];
  const topicFrom = index.topicStart[docId];
  for (let n = 0; n < index.topicCount[docId]; n++) {
    topics.push(readString(index, index.topicSlugSid[index.topicRefs[topicFrom + n]]));
  }
  const conference = index.conferences[index.conference[docId]];
  const event = index.events[index.event[docId]];
  const track = index.tracks[index.track[docId]];
  const level = index.difficulty[docId];
  const slug = readString(index, index.slugSid[docId]);
  const difficulty = level === UNCLASSIFIED ? null : (DIFFICULTY_BY_INDEX[level] ?? null);
  return {
    id: talkId(index, docId),
    slug,
    title: readString(index, index.titleSid[docId]),
    speakers,
    year: index.year[docId],
    conference: conference.slug,
    conferenceLabel: conference.label,
    event: event.shortName,
    track: track.slug,
    trackName: track.name,
    topics,
    difficulty,
    url: `${origin}/talks/${slug}`,
  };
}

function talkId(index: RuntimeIndex, docId: number): string {
  const event = index.events[index.event[docId]].slug;
  const village = index.villages[index.village[docId]].slug;
  const youtubeId = readString(index, index.youtubeSid[docId]);
  return `${event}-${village}-${youtubeId}`;
}

function findDocId(index: RuntimeIndex, id: string): number | null {
  const [hi, lo] = fnv1a64(id);
  let low = 0;
  let high = index.hashDoc.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const midHi = index.hashHi[mid];
    const midLo = index.hashLo[mid];
    if (midHi === hi && midLo === lo) {
      let left = mid;
      while (left > 0 && index.hashHi[left - 1] === hi && index.hashLo[left - 1] === lo) left -= 1;
      let right = mid;
      const last = index.hashDoc.length - 1;
      while (right < last && index.hashHi[right + 1] === hi && index.hashLo[right + 1] === lo) right += 1;
      for (let i = left; i <= right; i++) {
        const docId = index.hashDoc[i];
        if (talkId(index, docId) === id) return docId;
      }
      return null;
    }
    if (midHi < hi || (midHi === hi && midLo < lo)) low = mid + 1;
    else high = mid - 1;
  }
  return null;
}

function emptyFacets(query: SearchQuery, meta: SearchMeta | null): SearchFacets {
  const difficulties =
    meta?.difficulties.map((facet) => ({ ...facet, count: 0 })) ??
    DIFFICULTY_BY_INDEX.map((value) => ({ value, label: difficultyLabel(value), count: 0 }));
  return {
    years: ensureYears([], query.years),
    conferences: ensureValues([], query.conferences, (slug) => slug),
    tracks: ensureValues([], query.tracks, (slug) => slug),
    topics: query.topics.map((slug) => ({ value: slug, label: topicLabel(slug), count: 0 })),
    topicsTruncated: false,
    topicTotal: 0,
    difficulties,
  };
}

export function searchTalks(
  index: RuntimeIndex,
  query: SearchQuery,
  meta: SearchMeta | null,
  origin: string,
): SearchResponse {
  const text = matchText(index, query.terms);
  const groups = filterGroups(index, query);
  const filtered = applyFilters(text, groups);
  const total = filtered === "all" ? index.docCount : filtered === "empty" ? 0 : filtered.ids.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);

  let docIds: number[] = [];
  if (filtered === "all") {
    const start = (query.page - 1) * query.pageSize;
    const end = Math.min(start + query.pageSize, index.docCount);
    if (start < index.docCount) {
      for (const docId of index.newestOrder.subarray(start, end)) docIds.push(docId);
    }
  } else if (filtered !== "empty") {
    docIds = pageDocs(index, filtered, query);
  }

  const facets =
    filtered === "empty" && text === "none"
      ? emptyFacets(query, meta)
      : buildFacets(index, query, text, groups, meta);

  return {
    query: {
      q: query.q,
      terms: query.terms,
      year: query.years,
      conference: query.conferences,
      track: query.tracks,
      topic: query.topics,
      difficulty: query.difficulties,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    },
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages,
    results: docIds.map((docId) => materialize(index, docId, origin)),
    facets,
  };
}

export function getTalkById(index: RuntimeIndex, id: string, origin: string): TalkDetail | null {
  const docId = findDocId(index, id);
  if (docId == null) return null;
  const hit = materialize(index, docId, origin);
  const youtubeId = readString(index, index.youtubeSid[docId]);
  return {
    ...hit,
    eventSlug: index.events[index.event[docId]].slug,
    village: index.villages[index.village[docId]].name,
    youtubeId,
    youtubeUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
  };
}
