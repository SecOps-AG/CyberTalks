import { slugifySpeaker } from "./search";
import { cleanSpeakerName, speakerPageVerdict, type SpeakerPageContext } from "./speakerHeuristics";

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
 * The credits on a talk that get a speaker page: real-looking names, cleaned
 * of "| Event" suffixes, one entry per slug. Everything that builds the speaker
 * index, the speaker lists in D1, or a link to /speakers/<slug> goes through
 * here so that the sitemap, the shards, and the talk page agree.
 */
export function speakerCredits(talk: CreditedTalk): SpeakerCredit[] {
  const context = speakerContext(talk);
  const seen = new Set<string>();
  const credits: SpeakerCredit[] = [];
  for (const raw of talk.speakers) {
    const verdict = speakerPageVerdict(raw, context);
    if (!verdict.ok) continue;
    const slug = slugifySpeaker(verdict.name);
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
