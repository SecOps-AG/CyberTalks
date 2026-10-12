import type { Metadata } from "next";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import { getTalkIndex, getTalks, getTaxonomy } from "@/lib/data";

export const metadata: Metadata = {
  title: "BSides",
  description: "Browse BSides talks in the archive.",
};

export default function BsidesHubPage() {
  const talks = getTalkIndex(getTalks().filter((talk) => talk.conference === "bsides"));

  const masthead = (
    <header className="space-y-3">
      <p className="eyebrow">Conference hub</p>
      <h1 className="font-display text-3xl font-bold tracking-[0.05em] text-acid">BSides</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-mint/70">
        {talks.length > 0
          ? `${talks.length.toLocaleString("en-US")} BSides talks — filter by year, track, or topic.`
          : "No BSides talks in the archive yet."}
      </p>
    </header>
  );

  return (
    <TalkBrowser
      talks={talks}
      hide={["conferences", "villages"]}
      topicLabels={getTaxonomy().topicLabels}
      masthead={masthead}
      emptyHint="No BSides talks match these filters."
    />
  );
}
