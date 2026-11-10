import { S_TIER_CONFERENCES } from "./labels";
import type { TalkSummary } from "./types";

/**
 * Speaker pages with fewer talks than this mostly repeat the one talk page, so
 * they stay out of the index and the sitemap. Same idea as TOPIC_INDEX_MIN.
 */
export const SPEAKER_INDEX_MIN = 2;

export function speakerIsIndexable(talkCount: number): boolean {
  return talkCount >= SPEAKER_INDEX_MIN;
}

export function speakerRobots(talkCount: number): { index: boolean; follow: true } {
  return { index: speakerIsIndexable(talkCount), follow: true };
}

/**
 * "No summary" is the catalog's own rule, the one that makes the talk page say
 * "No summary yet": the summary is null, an empty string, or an object with
 * nothing in it. A teaser is a one-line blurb and never counts as a summary,
 * whatever its wording.
 */
export function talkHasSummary(summary: string | TalkSummary | null | undefined): boolean {
  if (summary == null) return false;
  if (typeof summary === "string") return summary.trim().length > 0;
  return Object.values(summary).some((value) => {
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return value != null;
  });
}

/**
 * The conferences the site leads with (DEF CON, Black Hat, BSides, RSAC,
 * TROOPERS). Their talks stay indexable without a written summary: the page
 * still has a title, event, speakers and video.
 */
export function isPriorityConference(conference: string): boolean {
  const slug = conference.toLowerCase();
  return S_TIER_CONFERENCES.some((tier) =>
    tier.slugs.some((alias) => slug === alias || slug.startsWith(`${alias}-`)),
  );
}

type IndexableTalk = {
  conference: string;
  summary?: string | TalkSummary | null;
};

/** A talk page is indexable with a summary, or when its conference is a priority one. */
export function talkIsIndexable(talk: IndexableTalk): boolean {
  return talkHasSummary(talk.summary) || isPriorityConference(talk.conference);
}

export function talkRobots(talk: IndexableTalk): { index: boolean; follow: true } {
  return { index: talkIsIndexable(talk), follow: true };
}
