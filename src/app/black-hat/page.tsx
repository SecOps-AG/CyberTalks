import type { Metadata } from "next";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import { loadHubPage } from "@/lib/page-runtime";
import { topicLabels } from "@/lib/topic-labels";

export const metadata: Metadata = {
  title: "Black Hat",
  description: "Browse Black Hat talks in the archive.",
};

export default async function BlackHatHubPage() {
  const { talks } = await loadHubPage("black-hat");

  const masthead = (
    <header className="space-y-3">
      <p className="eyebrow">Conference hub</p>
      <h1 className="font-display text-3xl font-bold tracking-[0.05em] text-acid">Black Hat</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-mint/70">
        {talks.length.toLocaleString("en-US")} Black Hat talks — filter by year, track, or topic.
      </p>
    </header>
  );

  return (
    <TalkBrowser
      talks={talks}
      hide={["conferences", "villages"]}
      topicLabels={topicLabels()}
      masthead={masthead}
      emptyHint="No Black Hat talks match these filters."
    />
  );
}
