import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import { loadSpeaker } from "@/lib/catalog-runtime";
import { speakerJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/page-meta";
import { speakerRobots } from "@/lib/indexability";
import { initialBrowsePage } from "@/lib/search";
import { isSpeakerPageName } from "@/lib/speakerHeuristics";
import { topicLabels } from "@/lib/topic-labels";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [];
}

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const record = await loadSpeaker(slug);
  const speaker = record?.speaker;
  if (!speaker || !isSpeakerPageName(speaker.name)) {
    return { title: "Speaker not found", robots: { index: false, follow: false } };
  }
  return {
    ...pageMetadata({
      title: speaker.name,
      description: `Every talk by ${speaker.name} on Cyber Talks.`,
      path: `/speakers/${encodeURIComponent(speaker.slug)}`,
    }),
    // Speakers with a single talk mostly repeat that talk page.
    robots: speakerRobots(speaker.talkCount),
  };
}

export default async function SpeakerPage({ params }: Props) {
  const { slug } = await params;
  const record = await loadSpeaker(slug);
  // A credit that reads like a title or label has no page, even if an old index still lists it.
  if (!record || !isSpeakerPageName(record.speaker.name)) notFound();
  const { speaker, talks } = record;
  const initial = initialBrowsePage(talks);
  // When the server slice already holds every talk there is nothing left to fetch,
  // so the page carries the whole list and never shows a "loading" state.
  const complete = initial.talks.length === talks.length;

  return (
    <div className="space-y-8">
      <JsonLd data={speakerJsonLd(speaker)} />
      <header className="space-y-3">
        <p className="eyebrow">
          <Link href="/speakers" className="hover:text-acid">
            Speakers
          </Link>
        </p>
        <h1 className="font-display text-3xl font-bold tracking-[0.05em] text-acid">
          {speaker.name}
        </h1>
        <p className="text-sm text-mint/60">
          {speaker.talkCount} talk{speaker.talkCount === 1 ? "" : "s"} in the archive.
        </p>
      </header>

      {/* The speaker facet is pinned by the page itself — offering it again would
          only ever narrow to co-presenters. */}
      <TalkBrowser
        talks={initial.talks}
        listing={complete ? undefined : { kind: "speaker", key: speaker.slug }}
        catalogSize={talks.length}
        resultSize={initial.total}
        hide={["speakers"]}
        topicLabels={topicLabels()}
        emptyHint={`No ${speaker.name} talks match these filters.`}
      />
    </div>
  );
}
