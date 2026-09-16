import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import {
  getSeries,
  getTalkIndex,
  getTalksForSeries,
  getTaxonomy,
  getVillageSeries,
} from "@/lib/data";

type Props = { params: Promise<{ village: string }> };

export function generateStaticParams() {
  return getVillageSeries().map((series) => ({ village: series.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { village } = await params;
  const series = getSeries(village);
  if (!series) return { title: "Village not found" };
  return {
    title: series.name,
    description: series.description,
  };
}

export default async function VillageSeriesPage({ params }: Props) {
  const { village } = await params;
  const series = getSeries(village);
  if (!series) notFound();

  const talks = getTalkIndex(getTalksForSeries(series.slug));

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <p className="eyebrow">
          <Link href="/villages" className="hover:text-acid">
            Villages
          </Link>
        </p>
        <h1 className="font-display text-3xl font-bold tracking-[0.05em] text-acid">
          {series.name}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-mint/80">{series.description}</p>
        <div className="flex flex-wrap gap-2">
          {series.editions.map((edition) => (
            <Link
              key={edition.id}
              href={`/${edition.eventSlug}/${edition.villageSlug}`}
              className="chip"
            >
              {edition.eventName}
              <span className="text-[10px] text-mint/40">{edition.talkCount}</span>
            </Link>
          ))}
        </div>
      </header>

      <TalkBrowser
        talks={talks}
        hide={["villages"]}
        topicLabels={getTaxonomy().topicLabels}
        emptyHint={`No ${series.name} talks match these filters.`}
      />
    </div>
  );
}
