import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import { loadTopic } from "@/lib/catalog-runtime";
import { topicLabel, topicLabels } from "@/lib/topic-labels";

type Props = { params: Promise<{ topic: string }> };

export function generateStaticParams() {
  return [];
}

export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  const label = topicLabel(topic);
  return {
    title: `Topic: ${label}`,
    description: `Conference talks tagged ${label}.`,
  };
}

export default async function TopicPage({ params }: Props) {
  const { topic } = await params;
  const talks = await loadTopic(topic);
  if (!talks) notFound();

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
        talks={talks}
        topicLabels={topicLabels()}
        emptyHint="No talks match these filters."
      />
    </div>
  );
}
