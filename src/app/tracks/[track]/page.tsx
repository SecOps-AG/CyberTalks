import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import {
  getTalkIndex,
  getTalksForTrack,
  getTaxonomy,
  getTrack,
  getTrackCounts,
} from "@/lib/data";

type Props = { params: Promise<{ track: string }> };

export function generateStaticParams() {
  return getTrackCounts().map(({ track }) => ({ track: track.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { track: slug } = await params;
  const track = getTrack(slug);
  if (!track) return { title: "Track not found" };
  return { title: track.name, description: track.blurb };
}

export default async function TrackPage({ params }: Props) {
  const { track: slug } = await params;
  const track = getTrack(slug);
  if (!track) notFound();

  const talks = getTalkIndex(getTalksForTrack(track.slug));
  if (talks.length === 0) notFound();

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="eyebrow">
          <Link href="/tracks" className="hover:text-acid">
            Tracks
          </Link>
        </p>
        <h1 className="font-display text-3xl font-bold tracking-[0.05em] text-acid">
          {track.name}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-mint/75">{track.blurb}</p>
      </header>

      <TalkBrowser
        talks={talks}
        hide={["tracks"]}
        topicLabels={getTaxonomy().topicLabels}
        emptyHint={`No ${track.name} talks match these filters.`}
      />
    </div>
  );
}
