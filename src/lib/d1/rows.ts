import { createHash } from "node:crypto";
import { buildIndexEntry, slugifySpeaker } from "../search";
import type { Talk } from "../types";

export type SpeakerLink = { slug: string; name: string };

export type TalkRow = {
  id: string;
  slug: string;
  seq: number;
  youtubeId: string;
  sourceFile: string;
  editionId: string;
  eventSlug: string;
  villageSlug: string;
  conference: string;
  year: number;
  track: string;
  kind: string;
  hasSummary: number;
  viewCount: number | null;
  summaryText: string | null;
  body: string;
  indexJson: string;
  relatedIds: string;
  topics: string[];
  speakers: SpeakerLink[];
  contentHash: string;
};

/** Text used by the browser's summary search. Objects contribute their overview. */
export function summaryText(summary: Talk["summary"]): string | null {
  if (typeof summary === "string") return summary || null;
  if (summary && typeof summary === "object" && typeof summary.overview === "string") {
    return summary.overview || null;
  }
  return null;
}

export function topicList(talk: Talk): string[] {
  return [...new Set(talk.topics.filter((topic) => topic.length > 0))];
}

export function speakerLinks(talk: Talk): SpeakerLink[] {
  const seen = new Set<string>();
  const links: SpeakerLink[] = [];
  for (const name of talk.speakers) {
    const slug = slugifySpeaker(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    links.push({ slug, name });
  }
  return links;
}

export function contentHash(
  sourceFile: string,
  seq: number,
  body: string,
  relatedIds: string,
): string {
  return createHash("sha256")
    .update(sourceFile)
    .update("\n")
    .update(String(seq))
    .update("\n")
    .update(body)
    .update("\n")
    .update(relatedIds)
    .digest("hex");
}

export function rowFromTalk(
  talk: Talk,
  sourceFile: string,
  seq: number,
  relatedIds: string[],
): TalkRow {
  const body = JSON.stringify(talk);
  const related = JSON.stringify(relatedIds);
  return {
    id: talk.id,
    slug: talk.slug,
    seq,
    youtubeId: talk.youtubeId,
    sourceFile,
    editionId: talk.villageId,
    eventSlug: talk.eventSlug,
    villageSlug: talk.villageSlug,
    conference: talk.conference,
    year: talk.year,
    track: talk.track,
    kind: talk.kind,
    hasSummary: talk.summary ? 1 : 0,
    viewCount: typeof talk.viewCount === "number" ? talk.viewCount : null,
    summaryText: summaryText(talk.summary),
    body,
    indexJson: JSON.stringify(buildIndexEntry(talk)),
    relatedIds: related,
    topics: topicList(talk),
    speakers: speakerLinks(talk),
    contentHash: contentHash(sourceFile, seq, body, related),
  };
}
