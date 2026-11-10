import { SPEAKER_INDEX_MIN } from "./indexability";
import { slugifySpeaker } from "./search";
import oneWordSpeakerTalks from "../generated/one-word-speakers.json";
import {
  cleanSpeakerName,
  speakerPageVerdict,
  type SpeakerPageContext,
  type SpeakerVerdict,
} from "./speakerHeuristics";

export type SpeakerCredit = { slug: string; name: string };

type CreditedTalk = {
  speakers: readonly string[];
  title: string;
  eventName?: string;
  villageName?: string;
  eventLabel?: string;
};

export function speakerContext(talk: Omit<CreditedTalk, "speakers">): SpeakerPageContext {
  return {
    title: talk.title,
    eventName: talk.eventName,
    villageName: talk.villageName,
    eventLabel: talk.eventLabel,
  };
}

/**
 * Talk counts for one-word credits that recur (slug -> talks, always 2 or
 * more). A single word is a handle or a first name, so it gets a page only
 * when this map says it has repeat talks. Built from the whole catalog by
 * `scripts/generate-one-word-speakers.ts` and checked against it in the tests.
 */
export type OneWordCounts = Readonly<Record<string, number>>;
export const ONE_WORD_SPEAKER_TALKS: OneWordCounts = oneWordSpeakerTalks;

/** `speakerPageVerdict` with the one-word talk count looked up by slug. */
export function speakerVerdict(
  raw: string,
  ctx: SpeakerPageContext = {},
  counts: OneWordCounts = ONE_WORD_SPEAKER_TALKS,
): SpeakerVerdict & { slug: string } {
  const slug = slugifySpeaker(cleanSpeakerName(raw));
  return { ...speakerPageVerdict(raw, ctx, { oneWordTalks: counts[slug] ?? 0 }), slug };
}

/**
 * The credits on a talk that get a speaker page: real-looking names, cleaned
 * of "| Event" suffixes, one entry per slug. Everything that builds the speaker
 * index, the speaker lists in D1, or a link to /speakers/<slug> goes through
 * here so that the sitemap, the shards, and the talk page agree.
 */
export function speakerCredits(
  talk: CreditedTalk,
  counts: OneWordCounts = ONE_WORD_SPEAKER_TALKS,
): SpeakerCredit[] {
  const context = speakerContext(talk);
  const seen = new Set<string>();
  const credits: SpeakerCredit[] = [];
  for (const raw of talk.speakers) {
    const verdict = speakerVerdict(raw, context, counts);
    if (!verdict.ok) continue;
    const { slug } = verdict;
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    credits.push({ slug, name: verdict.name });
  }
  return credits;
}

/** A credit as it should read on a talk page: cleaned, not necessarily linkable. */
export function displaySpeakerName(raw: string): string {
  return cleanSpeakerName(raw) || raw.trim();
}

/**
 * Talk counts for the one-word credits that recur, over a whole catalog.
 * Counted the way the speaker index counts a slug: one per talk, after
 * `cleanSpeakerName`, with every other rule still applied. A slug that only
 * a multi-word credit uses is not listed, and neither is one with a single talk.
 */
export function countOneWordSpeakers(talks: readonly CreditedTalk[]): Record<string, number> {
  const everyone = Number.POSITIVE_INFINITY;
  const counts = new Map<string, number>();
  const oneWord = new Set<string>();
  for (const talk of talks) {
    const context = speakerContext(talk);
    const seen = new Set<string>();
    for (const raw of talk.speakers) {
      const verdict = speakerPageVerdict(raw, context, { oneWordTalks: everyone });
      if (!verdict.ok) continue;
      const slug = slugifySpeaker(verdict.name);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      if (verdict.reason === "one_word_repeat") oneWord.add(slug);
    }
    for (const slug of seen) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  const out: Record<string, number> = {};
  for (const slug of [...oneWord].sort()) {
    const count = counts.get(slug) ?? 0;
    if (count >= SPEAKER_INDEX_MIN) out[slug] = count;
  }
  return out;
}
