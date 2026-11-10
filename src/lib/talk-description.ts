import { inDefconVillage } from "./hubs";
import { displaySpeakerName } from "./speaker-credits";
import { speakerPageVerdict } from "./speakerHeuristics";
import { eventYearLabel } from "./talk-title";
import type { Talk, TalkSummary } from "./types";

/** About how much of the summary or teaser a search snippet shows. */
export const DESCRIPTION_LENGTH = 150;
/** Hard ceiling for the factual fallback line. */
const FALLBACK_MAX = 160;

type DescribedTalk = Pick<
  Talk,
  "title" | "teaser" | "speakers" | "villageName" | "eventName" | "year" | "topics" | "conference" | "eventSlug"
> & {
  summary?: string | TalkSummary | null;
  eventLabel?: string;
  trackName?: string;
};

const VERBS =
  "(?:explores?|investigates?|details?|examines?|analy[sz]es?|reviews?|presents?|outlines?|demonstrates?|discusses?|provides?|evaluates?)";

/** Sentence frames the ingest step wrapped around the title. They say nothing about the talk. */
const BOILERPLATE: RegExp[] = [
  /^security researchers (?:examine|investigate) /i,
  /^analysts investigate attack surfaces and defenses concerning /i,
  /^industry experts analy[sz]e emerging threats surrounding /i,
  /^presenters detail vulnerability discovery and exploitation in /i,
  /^engineers explore architecture and security mechanisms for /i,
  /and (?:evaluates|analy[sz]e) (?:key implications for security practitioners|defensive countermeasures)\.?$/i,
  /^coverage of .* from the conference program\.?$/i,
  / — DEF CON Conference upload\.?$/i,
  /and practical defenses\.?$/i,
  /^presentation on [a-z ,&-]+\.?$/i,
  /^reviews strategic developments and technical considerations for cybersecurity operations\.?$/i,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when a teaser is the generated frame around the title ("X explores
 * <title>.", "Details <title> and evaluates key implications…") rather than a
 * sentence about what the talk delivers. Judged after masking the title and
 * speakers, so a real sentence that merely mentions the title is kept.
 */
export function isBoilerplateTeaser(
  teaser: string,
  talk: Pick<DescribedTalk, "title" | "speakers">,
): boolean {
  const text = teaser.replace(/\s+/g, " ").trim();
  if (!text) return true;
  if (BOILERPLATE.some((pattern) => pattern.test(text))) return true;

  let masked = text;
  const title = talk.title.trim();
  if (title) masked = masked.replace(new RegExp(escapeRegExp(title), "gi"), "{T}");
  for (const name of talk.speakers) {
    const trimmed = name.trim();
    if (trimmed) masked = masked.replace(new RegExp(escapeRegExp(trimmed), "gi"), "{S}");
  }
  if (!masked.includes("{T}")) return false;
  // Title plus a verb and nothing else: "{S} explores {T}.", "Details {T}."
  const stripped = masked
    .replace(/\{[TS]\}/g, " ")
    .replace(new RegExp(`\\b${VERBS}\\b`, "gi"), " ")
    .replace(/\b(?:at|with|from|and|the|of|a|an|in)\b/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return stripped.split(" ").filter(Boolean).length < 3;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^\s*#{1,6}\s+.*$/gm, " ")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\(AI summary[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    // A label such as "Overview:" and a leading timestamp say nothing in a snippet.
    .replace(/^(?:overview|summary|abstract)\s*:\s*/i, "")
    .replace(/^at \d{1,2}:\d{2}(?::\d{2})?,?\s*/i, "");
}

/** Cut at a word boundary near `limit`, ending with an ellipsis when text was lost. */
export function clip(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const boundary = cut.lastIndexOf(" ");
  const head = boundary > limit * 0.6 ? cut.slice(0, boundary) : cut;
  return `${head.replace(/[\s,;:.\-–—(]+$/u, "")}…`;
}

function summaryLead(summary: DescribedTalk["summary"]): string {
  if (summary == null) return "";
  const text = typeof summary === "string" ? summary : (summary.overview ?? "");
  return typeof text === "string" ? stripMarkdown(text) : "";
}

function factualLine(talk: DescribedTalk, labels: Record<string, string>): string {
  const label = eventYearLabel(talk);
  const people = talk.speakers
    .filter((name) => speakerPageVerdict(name, { title: talk.title }).ok)
    .map(displaySpeakerName)
    .slice(0, 2);
  const venue = inDefconVillage({ conference: talk.conference, eventSlug: talk.eventSlug })
    ? talk.villageName
    : talk.trackName && talk.trackName !== talk.eventName
      ? talk.trackName
      : "";
  const topics = talk.topics
    .slice(0, 2)
    .map((topic) => labels[topic] ?? topic.replace(/-/g, " "))
    .filter(Boolean);

  const where = venue && venue !== label ? `${label} (${venue})` : label;
  const subject = people.length > 0 ? `${people.join(" and ")} at ${where}` : `Talk from ${where}`;
  const about = topics.length > 0 ? `: ${topics.join(", ")}` : "";
  const line = `${subject}${about}. Watch the video on Cyber Talks.`;
  return line.length <= FALLBACK_MAX ? line : clip(line, FALLBACK_MAX);
}

/**
 * Meta description for a talk, in order of preference:
 *  1. the first ~150 characters of our own summary,
 *  2. our own teaser, unless it is the generated frame around the title,
 *  3. a factual line built from the record: who, where, the first topics.
 * Never transcript or conference-abstract text; only fields written for this site.
 */
export function talkDescription(talk: DescribedTalk, labels: Record<string, string> = {}): string {
  const lead = summaryLead(talk.summary);
  if (lead) return clip(lead, DESCRIPTION_LENGTH);
  const teaser = talk.teaser?.trim();
  if (teaser && !isBoilerplateTeaser(teaser, talk)) return clip(teaser, DESCRIPTION_LENGTH);
  return factualLine(talk, labels);
}
