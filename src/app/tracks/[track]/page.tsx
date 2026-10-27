import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import routes from "@/generated/page-routes.json";
import { loadTrackPage } from "@/lib/page-runtime";
import { initialBrowsePage } from "@/lib/search";
import { topicLabels } from "@/lib/topic-labels";

type Props = { params: Promise<{ track: string }> };

export function generateStaticParams() {
  return routes.tracks.map((track) => ({ track }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { track: slug } = await params;
  const page = await loadTrackPage(slug);
  if (!page) return { title: "Track not found" };
  return { title: page.track.name, description: page.track.blurb };
}

export default async function TrackPage({ params }: Props) {
  const { track: slug } = await params;
  const page = await loadTrackPage(slug);
  if (!page) notFound();
  const { track, talks } = page;
  const initial = initialBrowsePage(talks);

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
        talks={initial.talks}
        listing={{ kind: "track", key: track.slug }}
        catalogSize={talks.length}
        resultSize={initial.total}
        hide={["tracks"]}
        topicLabels={topicLabels()}
        emptyHint={`No ${track.name} talks match these filters.`}
      />
    </div>
  );
}
