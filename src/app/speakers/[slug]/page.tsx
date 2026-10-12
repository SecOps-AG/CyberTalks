import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import {
  getSpeaker,
  getTalkIndex,
  getTalksForSpeaker,
  getTaxonomy,
} from "@/lib/data";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [];
}

export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const speaker = getSpeaker(slug);
  if (!speaker) return { title: "Speaker not found" };
  return {
    title: speaker.name,
    description: `Every talk by ${speaker.name} on Cyber Talks.`,
  };
}

export default async function SpeakerPage({ params }: Props) {
  const { slug } = await params;
  const speaker = getSpeaker(slug);
  if (!speaker) notFound();

  const talks = getTalkIndex(getTalksForSpeaker(speaker.slug));

  return (
    <div className="space-y-8">
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
        talks={talks}
        hide={["speakers"]}
        topicLabels={getTaxonomy().topicLabels}
        emptyHint={`No ${speaker.name} talks match these filters.`}
      />
    </div>
  );
}
