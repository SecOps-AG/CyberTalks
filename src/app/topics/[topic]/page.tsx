import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import { loadTopic } from "@/lib/catalog-runtime";
import { canonicalUrl } from "@/lib/canonical";
import { initialBrowse } from "@/lib/search";
import { topicLabel, topicLabels } from "@/lib/topic-labels";
import { topicRobots } from "@/lib/topic-indexability";

type Props = { params: Promise<{ topic: string }> };

export function generateStaticParams() {
  return [];
}

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  const label = topicLabel(topic);
  const talks = await loadTopic(topic);
  if (!talks) {
    return { title: "Topic not found", robots: { index: false, follow: false } };
  }
  return {
    title: `Topic: ${label}`,
    description: `Conference talks tagged ${label}.`,
    alternates: { canonical: canonicalUrl(`/topics/${encodeURIComponent(topic)}`) },
    robots: topicRobots(talks.length),
  };
}

export default async function TopicPage({ params }: Props) {
  const { topic } = await params;
  const talks = await loadTopic(topic);
  if (!talks) notFound();
  const initial = initialBrowse(talks);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="eyebrow">
          <Link href="/topics" className="hover:text-acid">
            Topics
          </Link>
        </p>
        <h1 className="font-display text-3xl font-bold tracking-[0.05em] text-acid">
          {topicLabel(topic)}
        </h1>
        <p className="text-sm text-mint/60">
          {talks.length} talk{talks.length === 1 ? "" : "s"} tagged with this topic.
        </p>
      </header>

      <TalkBrowser
        talks={initial.talks}
        listing={{ kind: "topic", key: topic }}
        initialFacets={initial.facets}
        catalogSize={talks.length}
        resultSize={initial.total}
        topicLabels={topicLabels()}
        emptyHint="No talks match these filters."
      />
    </div>
  );
}
