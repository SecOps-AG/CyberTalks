import type { Metadata } from "next";
import Link from "next/link";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import {
  getDefconEditions,
  getTalkIndex,
  getTalks,
  getTaxonomy,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "DEF CON",
  description: "Browse every DEF CON talk in the archive — villages, tracks, and years.",
};

export default function DefconHubPage() {
  const talks = getTalkIndex(getTalks().filter((talk) => talk.conference === "defcon"));
  const editions = getDefconEditions();

  const masthead = (
    <header className="space-y-3">
      <p className="eyebrow">Conference hub</p>
      <h1 className="font-display text-3xl font-bold tracking-[0.05em] text-acid">DEF CON</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-mint/70">
        {talks.length.toLocaleString("en-US")} talks across {editions.length} villages. Villages are
        a DEF CON thing — filter by village, year, track, or topic.
      </p>
      <p className="text-[11px] uppercase tracking-[0.14em] text-mint/50">
        <Link href="/defcon/villages" className="text-cyan hover:text-acid">
          Browse all villages
        </Link>
      </p>
    </header>
  );

  return (
    <TalkBrowser
      talks={talks}
      hide={["conferences"]}
      topicLabels={getTaxonomy().topicLabels}
      masthead={masthead}
      emptyHint="No DEF CON talks match these filters."
    />
  );
}
