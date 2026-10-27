/**
 * Build the compact search index from talk-index rows.
 * Only kind "talk" is searchable, matching the archive's default browse.
 */

import taxonomy from "../../../data/taxonomy.json";
import { conferenceLabel, difficultyLabel } from "../labels";
import { topicLabel } from "../topic-labels";
import type { Difficulty, TalkKind } from "../types";
import { Writer, writeHeader } from "./binary";
import {
  DIFFICULTY_BY_INDEX,
  DIFFICULTY_INDEX,
  SEARCH_INDEX_VERSION,
  TOPIC_FACET_LIMIT,
  UNCLASSIFIED,
  type IndexHeader,
} from "./format";
import { fnv1a64 } from "./hash";
import type { Facet, SearchMeta, YearFacet } from "./model";
import { tokensOf } from "./tokenize";

const KINDS = new Set<TalkKind>(["talk", "clip", "interview", "announcement"]);

const trackNames = new Map(
  (taxonomy.tracks ?? []).map((track) => [track.slug, track.name] as const),
);

export type IndexSource = {
  id: string;
  slug: string;
  title: string;
  speakers?: string[];
  teaser?: string;
  year: number;
  conference: string;
  eventSlug: string;
  eventShortName: string;
  villageSlug: string;
  villageName: string;
  track: string;
  trackName?: string;
  topics?: string[];
  difficulty?: string | null;
  kind?: TalkKind;
  youtubeId: string;
};

class Intern {
  private readonly map = new Map<string, number>();
  readonly values: string[] = [];

  id(value: string): number {
    const found = this.map.get(value);
    if (found !== undefined) return found;
    const id = this.values.length;
    this.values.push(value);
    this.map.set(value, id);
    return id;
  }

  encode(): { bytes: Uint8Array; ends: Uint32Array } {
    const encoder = new TextEncoder();
    const parts = this.values.map((value) => encoder.encode(value));
    let total = 0;
    for (const part of parts) total += part.byteLength;
    const bytes = new Uint8Array(total);
    const ends = new Uint32Array(parts.length);
    let offset = 0;
    for (let i = 0; i < parts.length; i++) {
      bytes.set(parts[i], offset);
      offset += parts[i].byteLength;
      ends[i] = offset;
    }
    return { bytes, ends };
  }
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function difficultyOf(value: string | null | undefined): number {
  if (!value) return UNCLASSIFIED;
  const key = value.toLowerCase();
  return key in DIFFICULTY_INDEX ? DIFFICULTY_INDEX[key as Difficulty] : UNCLASSIFIED;
}

function byCount(a: Facet, b: Facet): number {
  return b.count - a.count || a.label.localeCompare(b.label);
}

function concatLists(lists: readonly number[][]): {
  blob: Uint32Array;
  start: Uint32Array;
  count: Uint32Array;
} {
  let total = 0;
  for (const list of lists) total += list.length;
  const blob = new Uint32Array(total);
  const start = new Uint32Array(lists.length);
  const count = new Uint32Array(lists.length);
  let cursor = 0;
  for (let i = 0; i < lists.length; i++) {
    start[i] = cursor;
    count[i] = lists[i].length;
    for (const id of lists[i]) blob[cursor++] = id;
  }
  return { blob, start, count };
}

function zipPairs(left: Uint32Array, right: Uint32Array): Uint32Array {
  const out = new Uint32Array(left.length * 2);
  for (let i = 0; i < left.length; i++) {
    out[i * 2] = left[i];
    out[i * 2 + 1] = right[i];
  }
  return out;
}

export function buildSearchIndex(entries: readonly IndexSource[]): {
  bytes: Uint8Array;
  meta: SearchMeta;
} {
  const kinds: SearchMeta["kinds"] = { talk: 0, clip: 0, interview: 0, announcement: 0 };
  const talks: IndexSource[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const kind = entry.kind ?? "talk";
    if (!KINDS.has(kind)) throw new Error(`Unexpected talk kind "${kind}" on ${entry.id}.`);
    kinds[kind] += 1;
    if (kind !== "talk") continue;
    if (!entry.id || !entry.slug || !entry.title || !entry.youtubeId) {
      throw new Error(`Talk ${entry.id || "(missing id)"} is missing id, slug, title, or youtube id.`);
    }
    if (seen.has(entry.id)) throw new Error(`Duplicate talk id ${entry.id}.`);
    const expectedId = `${entry.eventSlug}-${entry.villageSlug}-${entry.youtubeId}`;
    if (entry.id !== expectedId) {
      throw new Error(`Talk id ${entry.id} does not match ${expectedId}.`);
    }
    seen.add(entry.id);
    talks.push(entry);
  }

  const conferenceSlugs = sortedUnique(talks.map((talk) => talk.conference));
  const eventSlugs = sortedUnique(talks.map((talk) => talk.eventSlug));
  const villageSlugs = sortedUnique(talks.map((talk) => talk.villageSlug));
  const trackSlugs = sortedUnique(talks.map((talk) => talk.track));
  const topicSet = new Set<string>();
  for (const talk of talks) {
    for (const topic of talk.topics ?? []) topicSet.add(topic);
  }
  const topicSlugs = sortedUnique(topicSet);

  const conferenceIndex = new Map(conferenceSlugs.map((slug, index) => [slug, index]));
  const eventIndex = new Map(eventSlugs.map((slug, index) => [slug, index]));
  const villageIndex = new Map(villageSlugs.map((slug, index) => [slug, index]));
  const trackIndex = new Map(trackSlugs.map((slug, index) => [slug, index]));
  const topicIndex = new Map(topicSlugs.map((slug, index) => [slug, index]));

  const docCount = talks.length;
  const strings = new Intern();
  const year = new Uint16Array(docCount);
  const conference = new Uint16Array(docCount);
  const event = new Uint16Array(docCount);
  const village = new Uint16Array(docCount);
  const track = new Uint16Array(docCount);
  const difficulty = new Uint8Array(docCount);
  const titleSid = new Uint32Array(docCount);
  const slugSid = new Uint32Array(docCount);
  const youtubeSid = new Uint32Array(docCount);
  const speakerStart = new Uint32Array(docCount);
  const speakerCount = new Uint16Array(docCount);
  const topicStart = new Uint32Array(docCount);
  const topicCount = new Uint16Array(docCount);

  const speakerRefs: number[] = [];
  const topicRefs: number[] = [];
  const speakerNames: string[] = [];
  const speakerNameIndex = new Map<string, number>();

  const confDocs = conferenceSlugs.map(() => [] as number[]);
  const trackDocs = trackSlugs.map(() => [] as number[]);
  const topicDocs = topicSlugs.map(() => [] as number[]);
  const diffDocs: number[][] = [[], [], [], []];
  const yearDocs = new Map<number, number[]>();
  const postings = new Map<string, { ids: number[]; scores: number[] }>();
  const eventShort = new Map<string, string>();
  const villageNames = new Map<string, string>();
  const trackNameSeen = new Map<string, string>();

  for (let docId = 0; docId < docCount; docId++) {
    const talk = talks[docId];
    if (talk.year < 0 || talk.year > 65535) throw new Error(`Year out of range on ${talk.id}.`);
    year[docId] = talk.year;
    conference[docId] = conferenceIndex.get(talk.conference)!;
    event[docId] = eventIndex.get(talk.eventSlug)!;
    village[docId] = villageIndex.get(talk.villageSlug)!;
    track[docId] = trackIndex.get(talk.track)!;
    const level = difficultyOf(talk.difficulty);
    difficulty[docId] = level;
    titleSid[docId] = strings.id(talk.title);
    slugSid[docId] = strings.id(talk.slug);
    youtubeSid[docId] = strings.id(talk.youtubeId);

    speakerStart[docId] = speakerRefs.length;
    const seenSpeakers = new Set<number>();
    for (const name of talk.speakers ?? []) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      let nameIndex = speakerNameIndex.get(trimmed);
      if (nameIndex === undefined) {
        nameIndex = speakerNames.length;
        speakerNames.push(trimmed);
        speakerNameIndex.set(trimmed, nameIndex);
      }
      if (seenSpeakers.has(nameIndex)) continue;
      seenSpeakers.add(nameIndex);
      speakerRefs.push(nameIndex);
    }
    if (seenSpeakers.size > 65535) throw new Error(`Too many speakers on ${talk.id}.`);
    speakerCount[docId] = seenSpeakers.size;

    topicStart[docId] = topicRefs.length;
    const seenTopics = new Set<number>();
    for (const topic of talk.topics ?? []) {
      const index = topicIndex.get(topic);
      if (index === undefined || seenTopics.has(index)) continue;
      seenTopics.add(index);
      topicRefs.push(index);
    }
    if (seenTopics.size > 65535) throw new Error(`Too many topics on ${talk.id}.`);
    topicCount[docId] = seenTopics.size;

    if (!eventShort.has(talk.eventSlug)) eventShort.set(talk.eventSlug, talk.eventShortName);
    if (!villageNames.has(talk.villageSlug)) villageNames.set(talk.villageSlug, talk.villageName);
    if (talk.trackName && !trackNameSeen.has(talk.track)) trackNameSeen.set(talk.track, talk.trackName);

    confDocs[conference[docId]].push(docId);
    trackDocs[track[docId]].push(docId);
    for (const index of seenTopics) topicDocs[index].push(docId);
    if (level !== UNCLASSIFIED) diffDocs[level].push(docId);
    const yearList = yearDocs.get(talk.year);
    if (yearList) yearList.push(docId);
    else yearDocs.set(talk.year, [docId]);

    const scores = new Map<string, number>();
    const titleTokens = tokensOf(talk.title);
    titleTokens.forEach((token, index) => {
      scores.set(token, (scores.get(token) ?? 0) + (index === 0 ? 6 : 4));
    });
    for (const token of tokensOf((talk.speakers ?? []).join(" "))) {
      scores.set(token, (scores.get(token) ?? 0) + 2);
    }
    for (const token of tokensOf((talk.topics ?? []).join(" "))) {
      scores.set(token, (scores.get(token) ?? 0) + 1);
    }
    for (const token of tokensOf(
      [talk.teaser ?? "", talk.villageName, talk.eventShortName, talk.trackName ?? "", talk.track].join(" "),
    )) {
      if (!scores.has(token)) scores.set(token, 0);
    }
    for (const [token, score] of scores) {
      let list = postings.get(token);
      if (!list) {
        list = { ids: [], scores: [] };
        postings.set(token, list);
      }
      list.ids.push(docId);
      list.scores.push(score > 255 ? 255 : score);
    }
  }

  const newestIds = talks.map((_, index) => index);
  newestIds.sort((a, b) => {
    const channelA = talks[a].eventSlug === "defcon-channel" ? 1 : 0;
    const channelB = talks[b].eventSlug === "defcon-channel" ? 1 : 0;
    if (channelA !== channelB) return channelA - channelB;
    if (talks[a].year !== talks[b].year) return talks[b].year - talks[a].year;
    const byVillage = talks[a].villageName.localeCompare(talks[b].villageName);
    if (byVillage) return byVillage;
    const byTitle = talks[a].title.localeCompare(talks[b].title);
    if (byTitle) return byTitle;
    return a - b;
  });
  const newestRank = new Uint32Array(docCount);
  const newestOrder = Uint32Array.from(newestIds);
  for (let rank = 0; rank < newestIds.length; rank++) newestRank[newestIds[rank]] = rank;

  const hashes = talks.map((talk, docId) => {
    const [hi, lo] = fnv1a64(talk.id);
    return { hi, lo, docId };
  });
  hashes.sort((a, b) => a.hi - b.hi || a.lo - b.lo || a.docId - b.docId);

  const tokenEntries = [...postings.entries()]
    .map(([token, list]) => ({ token, ...list }))
    .sort((a, b) => (a.token < b.token ? -1 : a.token > b.token ? 1 : 0));
  let postingTotal = 0;
  for (const entry of tokenEntries) postingTotal += entry.ids.length;
  const postingIds = new Uint32Array(postingTotal);
  const postingScores = new Uint8Array(postingTotal);
  const tokenSid = new Uint32Array(tokenEntries.length);
  const tokenStart = new Uint32Array(tokenEntries.length);
  const tokenLen = new Uint32Array(tokenEntries.length);
  let postingCursor = 0;
  for (let i = 0; i < tokenEntries.length; i++) {
    const entry = tokenEntries[i];
    tokenSid[i] = strings.id(entry.token);
    tokenStart[i] = postingCursor;
    tokenLen[i] = entry.ids.length;
    for (let n = 0; n < entry.ids.length; n++) {
      postingIds[postingCursor] = entry.ids[n];
      postingScores[postingCursor] = entry.scores[n];
      postingCursor += 1;
    }
  }

  const confSlugSid = new Uint32Array(conferenceSlugs.length);
  const confLabelSid = new Uint32Array(conferenceSlugs.length);
  conferenceSlugs.forEach((slug, index) => {
    confSlugSid[index] = strings.id(slug);
    confLabelSid[index] = strings.id(conferenceLabel(slug));
  });

  const eventSlugSid = new Uint32Array(eventSlugs.length);
  const eventShortSid = new Uint32Array(eventSlugs.length);
  eventSlugs.forEach((slug, index) => {
    eventSlugSid[index] = strings.id(slug);
    eventShortSid[index] = strings.id(eventShort.get(slug) || slug);
  });

  const villageSlugSid = new Uint32Array(villageSlugs.length);
  const villageNameSid = new Uint32Array(villageSlugs.length);
  villageSlugs.forEach((slug, index) => {
    villageSlugSid[index] = strings.id(slug);
    villageNameSid[index] = strings.id(villageNames.get(slug) || slug);
  });

  const trackSlugSid = new Uint32Array(trackSlugs.length);
  const trackNameSid = new Uint32Array(trackSlugs.length);
  trackSlugs.forEach((slug, index) => {
    trackSlugSid[index] = strings.id(slug);
    trackNameSid[index] = strings.id(trackNames.get(slug) ?? trackNameSeen.get(slug) ?? slug);
  });

  const topicSlugSid = new Uint32Array(topicSlugs.length);
  const topicLabelSid = new Uint32Array(topicSlugs.length);
  topicSlugs.forEach((slug, index) => {
    topicSlugSid[index] = strings.id(slug);
    topicLabelSid[index] = strings.id(topicLabel(slug));
  });

  const speakerNameSid = new Uint32Array(speakerNames.length);
  speakerNames.forEach((name, index) => {
    speakerNameSid[index] = strings.id(name);
  });

  const yearsSorted = [...yearDocs.keys()].sort((a, b) => a - b);
  const yearLists = yearsSorted.map((value) => yearDocs.get(value)!);
  const yearPacked = concatLists(yearLists);
  const yearTriples = new Uint32Array(yearsSorted.length * 3);
  for (let i = 0; i < yearsSorted.length; i++) {
    yearTriples[i * 3] = yearsSorted[i];
    yearTriples[i * 3 + 1] = yearPacked.start[i];
    yearTriples[i * 3 + 2] = yearPacked.count[i];
  }

  const confPacked = concatLists(confDocs);
  const trackPacked = concatLists(trackDocs);
  const diffPacked = concatLists(diffDocs);
  const topicPacked = concatLists(topicDocs);

  const encoded = strings.encode();
  const header: IndexHeader = {
    version: SEARCH_INDEX_VERSION,
    docCount,
    stringBytes: encoded.bytes.byteLength,
    stringCount: encoded.ends.length,
    speakerRefCount: speakerRefs.length,
    topicRefCount: topicRefs.length,
    conferenceCount: conferenceSlugs.length,
    eventCount: eventSlugs.length,
    villageCount: villageSlugs.length,
    trackCount: trackSlugs.length,
    topicDictCount: topicSlugs.length,
    speakerDictCount: speakerNames.length,
    tokenCount: tokenEntries.length,
    postingCount: postingTotal,
    yearCount: yearsSorted.length,
    confFilterCount: conferenceSlugs.length,
    trackFilterCount: trackSlugs.length,
    difficultyCount: 4,
    topicFilterCount: topicSlugs.length,
    yearPostingCount: yearPacked.blob.length,
    confPostingCount: confPacked.blob.length,
    trackPostingCount: trackPacked.blob.length,
    diffPostingCount: diffPacked.blob.length,
    topicPostingCount: topicPacked.blob.length,
  };

  const writer = new Writer();
  writer.u8(encoded.bytes);
  writer.u32(encoded.ends);
  writer.u16(year);
  writer.u16(conference);
  writer.u16(event);
  writer.u16(village);
  writer.u16(track);
  writer.u8(difficulty);
  writer.u32(titleSid);
  writer.u32(slugSid);
  writer.u32(youtubeSid);
  writer.u32(speakerStart);
  writer.u16(speakerCount);
  writer.u32(topicStart);
  writer.u16(topicCount);
  writer.u32(newestRank);
  writer.u32(newestOrder);
  writer.u32(Uint32Array.from(speakerRefs));
  writer.u32(Uint32Array.from(topicRefs));
  writer.u32(zipPairs(confSlugSid, confLabelSid));
  writer.u32(zipPairs(eventSlugSid, eventShortSid));
  writer.u32(zipPairs(villageSlugSid, villageNameSid));
  writer.u32(zipPairs(trackSlugSid, trackNameSid));
  writer.u32(zipPairs(topicSlugSid, topicLabelSid));
  writer.u32(speakerNameSid);
  writer.u32(tokenSid);
  writer.u32(tokenStart);
  writer.u32(tokenLen);
  writer.u32(postingIds);
  writer.u8(postingScores);
  writer.u32(yearTriples);
  writer.u32(zipPairs(confPacked.start, confPacked.count));
  writer.u32(zipPairs(trackPacked.start, trackPacked.count));
  writer.u32(zipPairs(diffPacked.start, diffPacked.count));
  writer.u32(zipPairs(topicPacked.start, topicPacked.count));
  writer.u32(yearPacked.blob);
  writer.u32(confPacked.blob);
  writer.u32(trackPacked.blob);
  writer.u32(diffPacked.blob);
  writer.u32(topicPacked.blob);
  writer.u32(Uint32Array.from(hashes.map((row) => row.hi)));
  writer.u32(Uint32Array.from(hashes.map((row) => row.lo)));
  writer.u32(Uint32Array.from(hashes.map((row) => row.docId)));

  const bytes = writer.finish();
  writeHeader(bytes, header);

  const conferences: Facet[] = conferenceSlugs.map((slug, index) => ({
    value: slug,
    label: conferenceLabel(slug),
    count: confDocs[index].length,
  }));
  conferences.sort(byCount);

  const tracks: Facet[] = trackSlugs.map((slug, index) => ({
    value: slug,
    label: trackNames.get(slug) ?? trackNameSeen.get(slug) ?? slug,
    count: trackDocs[index].length,
  }));
  tracks.sort(byCount);

  const yearFacets: YearFacet[] = yearsSorted
    .map((value, index) => ({ value, label: String(value), count: yearLists[index].length }))
    .sort((a, b) => b.value - a.value);

  const difficulties: Facet[] = DIFFICULTY_BY_INDEX.map((level, index) => ({
    value: level,
    label: difficultyLabel(level),
    count: diffDocs[index].length,
  }));

  const topicsTop = topicSlugs
    .map((slug, index) => ({
      value: slug,
      label: topicLabel(slug),
      count: topicDocs[index].length,
    }))
    .sort(byCount)
    .slice(0, TOPIC_FACET_LIMIT);

  const meta: SearchMeta = {
    version: 1,
    talks: docCount,
    sourceRecords: entries.length,
    kinds,
    indexedKinds: ["talk"],
    years: yearFacets,
    conferences,
    tracks,
    difficulties,
    topicsTop,
    topicTotal: topicSlugs.length,
  };

  return { bytes, meta };
}
