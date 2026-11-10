import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import { loadHubPage } from "@/lib/page-runtime";
import { topicLabels } from "@/lib/topic-labels";

export const metadata: Metadata = pageMetadata({
  title: "BSides",
  description: "Browse BSides talks in the archive.",
  path: "/bsides",
});

export default async function BsidesHubPage() {
  const { talks } = await loadHubPage("bsides");

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
      pushFilters
      talks={talks}
      hide={["conferences", "villages"]}
      topicLabels={topicLabels()}
      masthead={masthead}
      emptyHint="No BSides talks match these filters."
    />
  );
}
