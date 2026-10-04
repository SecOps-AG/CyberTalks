import type { Talk } from "./types";

export const RELATED_LIMIT = 3;

function topicOverlap(talk: Talk, other: Talk): number {
  const topics = new Set(talk.topics);
  let shared = 0;
  for (const topic of other.topics) {
    if (topics.has(topic)) shared += 1;
  }
  return shared;
}

function scoreTalk(talk: Talk, other: Talk): number {
  return (
    topicOverlap(talk, other) * 3 +
    (other.track === talk.track ? 2 : 0) +
    (other.villageSlug === talk.villageSlug ? 1 : 0)
  );
}

type Scored = { index: number; score: number; year: number };

/** score desc, then year desc, then earlier in the archive. */
function compareScored(a: Scored, b: Scored): number {
  return b.score - a.score || b.year - a.year || a.index - b.index;
}

/**
 * The three talks most like this one.
 *
 * Shared topics count the most, then the same track, then the same village.
 * Ties keep archive order. Used on Node, where the full archive is already
 * in memory, and as the check for the bulk generator.
 */
export function relatedTalks(talk: Talk, talks: Talk[], limit = RELATED_LIMIT): Talk[] {
  const scored: Scored[] = [];
  for (let index = 0; index < talks.length; index++) {
    const other = talks[index];
    if (other.id === talk.id) continue;
    const score = scoreTalk(talk, other);
    if (score <= 0) continue;
    scored.push({ index, score, year: other.year });
  }
  scored.sort(compareScored);
  return scored.slice(0, limit).map((entry) => talks[entry.index]);
}

function pushIndex(map: Map<string, number[]>, key: string, index: number) {
  const list = map.get(key);
  if (list) list.push(index);
  else map.set(key, [index]);
}

function orderByYear(indexes: number[], talks: Talk[]): number[] {
  return indexes.slice().sort((a, b) => talks[b].year - talks[a].year || a - b);
}

function insertTop(top: Scored[], entry: Scored, limit: number) {
  if (top.length < limit) {
    top.push(entry);
    top.sort(compareScored);
    return;
  }
  if (compareScored(entry, top[top.length - 1]) >= 0) return;
  top[top.length - 1] = entry;
  top.sort(compareScored);
}

/**
 * Related talks for every talk in one pass.
 *
 * Candidates are only talks that share a topic, or the same village and track.
 * Same-track and same-village fillers are used only when that set has fewer
 * than `limit` hits, which is the same ranking as scanning the whole archive.
 */
export function relatedForAll(talks: Talk[], limit = RELATED_LIMIT): Talk[][] {
  const byTopic = new Map<string, number[]>();
  const byTrack = new Map<string, number[]>();
  const byVillage = new Map<string, number[]>();
  const byVillageTrack = new Map<string, number[]>();

  for (let index = 0; index < talks.length; index++) {
    const talk = talks[index];
    for (const topic of talk.topics) pushIndex(byTopic, topic, index);
    pushIndex(byTrack, talk.track, index);
    pushIndex(byVillage, talk.villageSlug, index);
    pushIndex(byVillageTrack, `${talk.villageSlug}\0${talk.track}`, index);
  }

  const trackOrder = new Map<string, number[]>();
  for (const [key, indexes] of byTrack) trackOrder.set(key, orderByYear(indexes, talks));
  const villageOrder = new Map<string, number[]>();
  for (const [key, indexes] of byVillage) villageOrder.set(key, orderByYear(indexes, talks));

  const result: Talk[][] = new Array(talks.length);

  for (let index = 0; index < talks.length; index++) {
    const talk = talks[index];
    const topics = new Set(talk.topics);
    const seen = new Set<number>();
    const high: Scored[] = [];

    const consider = (otherIndex: number) => {
      if (otherIndex === index || seen.has(otherIndex)) return;
      seen.add(otherIndex);
      const other = talks[otherIndex];
      let shared = 0;
      for (const topic of other.topics) {
        if (topics.has(topic)) shared += 1;
      }
      const score =
        shared * 3 +
        (other.track === talk.track ? 2 : 0) +
        (other.villageSlug === talk.villageSlug ? 1 : 0);
      if (score < 3) return;
      insertTop(high, { index: otherIndex, score, year: other.year }, limit);
    };

    for (const topic of talk.topics) {
      const list = byTopic.get(topic);
      if (list) for (const otherIndex of list) consider(otherIndex);
    }
    const sameEditionTrack = byVillageTrack.get(`${talk.villageSlug}\0${talk.track}`);
    if (sameEditionTrack) for (const otherIndex of sameEditionTrack) consider(otherIndex);

    if (high.length >= limit) {
      result[index] = high.map((entry) => talks[entry.index]);
      continue;
    }

    const picked = high.map((entry) => talks[entry.index]);
    const take = (order: number[] | undefined) => {
      if (!order) return;
      for (const otherIndex of order) {
        if (picked.length >= limit) return;
        if (otherIndex === index || seen.has(otherIndex)) continue;
        seen.add(otherIndex);
        picked.push(talks[otherIndex]);
      }
    };
    take(trackOrder.get(talk.track));
    take(villageOrder.get(talk.villageSlug));
    result[index] = picked;
  }

  return result;
}
