import type { Metadata } from "next";
import { TopicIndex } from "@/components/TopicIndex";
import { getTopicCounts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Topics",
  description: "Every topic tagged across the archive, with talk counts.",
};

export default function TopicsPage() {
  const topics = getTopicCounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[0.06em] text-acid">Topics</h1>
        <p className="mt-1 max-w-2xl text-sm text-mint/60">
          Topics are the long tail — free-form, several per talk, and growing with the archive.
          They live here rather than on top of every page.
        </p>
      </div>
      <TopicIndex topics={topics} />
    </div>
  );
}
