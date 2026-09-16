import type { Metadata } from "next";
import { SpeakerIndex } from "@/components/SpeakerIndex";
import { getSpeakers } from "@/lib/data";

export const metadata: Metadata = {
  title: "Speakers",
  description: "Every speaker in the archive, with the talks they gave.",
};

export default function SpeakersPage() {
  const speakers = getSpeakers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[0.06em] text-acid">Speakers</h1>
        <p className="mt-1 max-w-2xl text-sm text-mint/60">
          Names come straight from the talk credits, so a speaker page is simply every talk they
          are listed on. Open one, or filter by speaker from any browser.
        </p>
      </div>
      <SpeakerIndex speakers={speakers} />
    </div>
  );
}
