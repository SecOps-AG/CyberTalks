import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { SpeakerIndex } from "@/components/SpeakerIndex";
import { loadSpeakers } from "@/lib/page-runtime";
import { isLikelyPersonSpeaker } from "@/lib/speakerHeuristics";

/** Frequent presenters shown before anyone searches. */
const REPEAT_CAP = 48;

export const metadata: Metadata = pageMetadata({
  title: "Speakers",
  description: "Every speaker in the archive, with the talks they gave.",
  path: "/speakers",
});

export default async function SpeakersPage() {
  const speakers = await loadSpeakers();
  const people = speakers.filter((speaker) => isLikelyPersonSpeaker(speaker.name));
  const repeats = people
    .filter((speaker) => speaker.talkCount > 1)
    .slice(0, REPEAT_CAP)
    .map(({ name, slug, talkCount }) => ({ name, slug, talkCount }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[0.06em] text-acid">Speakers</h1>
        <p className="mt-1 max-w-2xl text-sm text-mint/60">
          Names come straight from the talk credits, so a speaker page is simply every talk they
          are listed on. Open one, or filter by speaker from any browser.
        </p>
      </div>
      <SpeakerIndex repeats={repeats} personCount={people.length} />
    </div>
  );
}
