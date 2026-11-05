import type { Metadata } from "next";
import { TopicIndex } from "@/components/TopicIndex";
import { canonicalUrl } from "@/lib/canonical";
import { loadTopicCounts } from "@/lib/page-runtime";
import { TOPIC_INDEX_MIN, topicIndexView, topicQueryValue } from "@/lib/topic-indexability";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = topicQueryValue((await searchParams).q);
  return {
    title: "Topics",
    description: "Topic hubs across the archive. The filter searches every topic.",
    alternates: { canonical: canonicalUrl("/topics") },
    robots: query ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function TopicsPage({ searchParams }: Props) {
  const query = topicQueryValue((await searchParams).q);
  const view = topicIndexView(await loadTopicCounts(), query);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[0.06em] text-acid">Topics</h1>
        <p className="mt-1 max-w-2xl text-sm text-mint/60">
          Hubs with {TOPIC_INDEX_MIN} or more talks are listed on this page. Use the filter to find
          any topic, including tags that only show up once or twice.
        </p>
      </div>
      <TopicIndex view={view} />
    </div>
  );
}
