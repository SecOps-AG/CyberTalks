import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import { getTalkIndex, getTalksForTopic, getTaxonomy, getTopicCounts } from "@/lib/data";

type Props = { params: Promise<{ topic: string }> };

export function generateStaticParams() {
  return getTopicCounts().map(({ topic }) => ({ topic }));
}

function labelFor(topic: string): string {
  return getTaxonomy().topicLabels[topic] ?? topic;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  return {
    title: `Topic: ${labelFor(topic)}`,
    description: `DEF CON talks tagged ${labelFor(topic)}.`,
  };
}

export default async function TopicPage({ params }: Props) {
  const { topic } = await params;
  const talks = getTalkIndex(getTalksForTopic(topic));
  if (talks.length === 0) notFound();

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="eyebrow">
          <Link href="/topics" className="hover:text-acid">
            Topics
          </Link>
        </p>
        <h1 className="font-display text-3xl font-bold tracking-[0.05em] text-acid">
          {labelFor(topic)}
        </h1>
        <p className="text-sm text-mint/60">
          {talks.length} talk{talks.length === 1 ? "" : "s"} tagged with this topic.
        </p>
      </header>

      <TalkBrowser
        talks={talks}
        topicLabels={getTaxonomy().topicLabels}
        emptyHint="No talks match these filters."
      />
    </div>
  );
}
