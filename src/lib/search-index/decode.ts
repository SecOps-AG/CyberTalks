/**
 * Map the build-time index into typed-array views. Strings are decoded on demand.
 */

import { Cursor, readHeader } from "./binary";
import { HEADER_BYTES } from "./format";

const decoder = new TextDecoder();
const STRING_CACHE_MAX = 8000;

type U8 = Uint8Array<ArrayBufferLike>;
type U16 = Uint16Array<ArrayBufferLike>;
type U32 = Uint32Array<ArrayBufferLike>;

export type Named = { slug: string; label: string };
export type EventRow = { slug: string; shortName: string };
export type VillageRow = { slug: string; name: string };
export type TrackRow = { slug: string; name: string };

export type RuntimeIndex = {
  docCount: number;
  stringBytes: U8;
  stringEnds: U32;
  stringCache: Map<number, string>;
  year: U16;
  conference: U16;
  event: U16;
  village: U16;
  track: U16;
  difficulty: U8;
  titleSid: U32;
  slugSid: U32;
  youtubeSid: U32;
  speakerStart: U32;
  speakerCount: U16;
  topicStart: U32;
  topicCount: U16;
  newestRank: U32;
  newestOrder: U32;
  speakerRefs: U32;
  topicRefs: U32;
  conferences: Named[];
  events: EventRow[];
  villages: VillageRow[];
  tracks: TrackRow[];
  topicSlugSid: U32;
  topicLabelSid: U32;
  speakerNameSid: U32;
  tokenSid: U32;
  tokenStart: U32;
  tokenCount: U32;
  postings: U32;
  scores: U8;
  yearValue: U32;
  yearStart: U32;
  yearCount: U32;
  confStart: U32;
  confCount: U32;
  trackStart: U32;
  trackCount: U32;
  diffStart: U32;
  diffCount: U32;
  topicPostStart: U32;
  topicPostCount: U32;
  yearPostings: U32;
  confPostings: U32;
  trackPostings: U32;
  diffPostings: U32;
  topicPostings: U32;
  hashHi: U32;
  hashLo: U32;
  hashDoc: U32;
};

function splitPairs(flat: U32): [U32, U32] {
  const count = flat.length / 2;
  const left = new Uint32Array(count);
  const right = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    left[i] = flat[i * 2];
    right[i] = flat[i * 2 + 1];
  }
  return [left, right];
}

function splitTriples(flat: U32): [U32, U32, U32] {
  const count = flat.length / 3;
  const a = new Uint32Array(count);
  const b = new Uint32Array(count);
  const c = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    a[i] = flat[i * 3];
    b[i] = flat[i * 3 + 1];
    c[i] = flat[i * 3 + 2];
  }
  return [a, b, c];
}

export function readString(index: RuntimeIndex, sid: number): string {
  const cached = index.stringCache.get(sid);
  if (cached !== undefined) return cached;
  const start = sid === 0 ? 0 : index.stringEnds[sid - 1];
  const end = index.stringEnds[sid];
  const value = decoder.decode(index.stringBytes.subarray(start, end));
  if (index.stringCache.size < STRING_CACHE_MAX) index.stringCache.set(sid, value);
  return value;
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength &&
    bytes.buffer instanceof ArrayBuffer
  ) {
    return bytes.buffer;
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function decodeSearchIndex(bytes: Uint8Array): RuntimeIndex {
  const buffer = ownedBuffer(bytes);
  const header = readHeader(buffer);
  const cursor = new Cursor(buffer, HEADER_BYTES);

  const stringBytes = cursor.u8(header.stringBytes);
  const stringEnds = cursor.u32(header.stringCount);
  const year = cursor.u16(header.docCount);
  const conference = cursor.u16(header.docCount);
  const event = cursor.u16(header.docCount);
  const village = cursor.u16(header.docCount);
  const track = cursor.u16(header.docCount);
  const difficulty = cursor.u8(header.docCount);
  const titleSid = cursor.u32(header.docCount);
  const slugSid = cursor.u32(header.docCount);
  const youtubeSid = cursor.u32(header.docCount);
  const speakerStart = cursor.u32(header.docCount);
  const speakerCount = cursor.u16(header.docCount);
  const topicStart = cursor.u32(header.docCount);
  const topicCount = cursor.u16(header.docCount);
  const newestRank = cursor.u32(header.docCount);
  const newestOrder = cursor.u32(header.docCount);
  const speakerRefs = cursor.u32(header.speakerRefCount);
  const topicRefs = cursor.u32(header.topicRefCount);
  const conferencePairs = cursor.u32(header.conferenceCount * 2);
  const eventPairs = cursor.u32(header.eventCount * 2);
  const villagePairs = cursor.u32(header.villageCount * 2);
  const trackPairs = cursor.u32(header.trackCount * 2);
  const topicPairs = cursor.u32(header.topicDictCount * 2);
  const speakerNameSid = cursor.u32(header.speakerDictCount);
  const tokenSid = cursor.u32(header.tokenCount);
  const tokenStart = cursor.u32(header.tokenCount);
  const tokenCount = cursor.u32(header.tokenCount);
  const postings = cursor.u32(header.postingCount);
  const scores = cursor.u8(header.postingCount);
  const yearTriples = cursor.u32(header.yearCount * 3);
  const confPairs = cursor.u32(header.confFilterCount * 2);
  const trackFilterPairs = cursor.u32(header.trackFilterCount * 2);
  const diffPairs = cursor.u32(header.difficultyCount * 2);
  const topicFilterPairs = cursor.u32(header.topicFilterCount * 2);
  const yearPostings = cursor.u32(header.yearPostingCount);
  const confPostings = cursor.u32(header.confPostingCount);
  const trackPostings = cursor.u32(header.trackPostingCount);
  const diffPostings = cursor.u32(header.diffPostingCount);
  const topicPostings = cursor.u32(header.topicPostingCount);
  const hashHi = cursor.u32(header.docCount);
  const hashLo = cursor.u32(header.docCount);
  const hashDoc = cursor.u32(header.docCount);

  const index: RuntimeIndex = {
    docCount: header.docCount,
    stringBytes,
    stringEnds,
    stringCache: new Map<number, string>(),
    year,
    conference,
    event,
    village,
    track,
    difficulty,
    titleSid,
    slugSid,
    youtubeSid,
    speakerStart,
    speakerCount,
    topicStart,
    topicCount,
    newestRank,
    newestOrder,
    speakerRefs,
    topicRefs,
    conferences: [],
    events: [],
    villages: [],
    tracks: [],
    topicSlugSid: new Uint32Array(),
    topicLabelSid: new Uint32Array(),
    speakerNameSid,
    tokenSid,
    tokenStart,
    tokenCount,
    postings,
    scores,
    yearValue: new Uint32Array(),
    yearStart: new Uint32Array(),
    yearCount: new Uint32Array(),
    confStart: new Uint32Array(),
    confCount: new Uint32Array(),
    trackStart: new Uint32Array(),
    trackCount: new Uint32Array(),
    diffStart: new Uint32Array(),
    diffCount: new Uint32Array(),
    topicPostStart: new Uint32Array(),
    topicPostCount: new Uint32Array(),
    yearPostings,
    confPostings,
    trackPostings,
    diffPostings,
    topicPostings,
    hashHi,
    hashLo,
    hashDoc,
  };

  const [confSlug, confLabel] = splitPairs(conferencePairs);
  const [eventSlug, eventShort] = splitPairs(eventPairs);
  const [villageSlug, villageName] = splitPairs(villagePairs);
  const [trackSlug, trackName] = splitPairs(trackPairs);
  const [topicSlug, topicLabelSid] = splitPairs(topicPairs);
  const [yearValue, yearStart, yearCount] = splitTriples(yearTriples);
  const [confStart, confCount] = splitPairs(confPairs);
  const [trackStart, trackCount] = splitPairs(trackFilterPairs);
  const [diffStart, diffCount] = splitPairs(diffPairs);
  const [topicPostStart, topicPostCount] = splitPairs(topicFilterPairs);

  index.topicSlugSid = topicSlug;
  index.topicLabelSid = topicLabelSid;
  index.yearValue = yearValue;
  index.yearStart = yearStart;
  index.yearCount = yearCount;
  index.confStart = confStart;
  index.confCount = confCount;
  index.trackStart = trackStart;
  index.trackCount = trackCount;
  index.diffStart = diffStart;
  index.diffCount = diffCount;
  index.topicPostStart = topicPostStart;
  index.topicPostCount = topicPostCount;

  index.conferences = Array.from({ length: confSlug.length }, (_, i) => ({
    slug: readString(index, confSlug[i]),
    label: readString(index, confLabel[i]),
  }));
  index.events = Array.from({ length: eventSlug.length }, (_, i) => ({
    slug: readString(index, eventSlug[i]),
    shortName: readString(index, eventShort[i]),
  }));
  index.villages = Array.from({ length: villageSlug.length }, (_, i) => ({
    slug: readString(index, villageSlug[i]),
    name: readString(index, villageName[i]),
  }));
  index.tracks = Array.from({ length: trackSlug.length }, (_, i) => ({
    slug: readString(index, trackSlug[i]),
    name: readString(index, trackName[i]),
  }));

  return index;
}
