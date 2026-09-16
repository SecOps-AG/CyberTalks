import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import {
  getEdition,
  getEditions,
  getSeries,
  getTalkIndex,
  getTalksForEdition,
  getTaxonomy,
} from "@/lib/data";

type Props = { params: Promise<{ event: string; village: string }> };

export function generateStaticParams() {
  return getEditions().map((edition) => ({
    event: edition.eventSlug,
    village: edition.villageSlug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { event, village } = await params;
  const edition = getEdition(event, village);
  if (!edition) return { title: "Village not found" };
  return {
    title: `${edition.villageName} — ${edition.eventName}`,
    description: edition.description,
  };
}

export default async function VillageEditionPage({ params }: Props) {
  const { event, village } = await params;
  const edition = getEdition(event, village);
  if (!edition) notFound();

  const series = getSeries(edition.villageSlug);
  const otherEditions = series?.editions.filter((item) => item.id !== edition.id) ?? [];
  const talks = getTalkIndex(getTalksForEdition(edition.id));

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <p className="eyebrow flex flex-wrap items-center gap-2">
          <Link href={`/${edition.eventSlug}`} className="hover:text-acid">
            {edition.eventName}
          </Link>
          <span className="text-mint/25">/</span>
          <Link href={`/villages/${edition.villageSlug}`} className="hover:text-acid">
            {edition.villageName} across years
          </Link>
        </p>
        <h1 className="font-display text-3xl font-bold tracking-[0.05em] text-acid">
          {edition.villageName}{" "}
          <span className="text-cyan/80">{edition.eventShortName}</span>
        </h1>
        <p className="text-[11px] uppercase tracking-[0.14em] text-mint/50">
          {edition.location} · {edition.dates} · {edition.talkCount} talks
        </p>
        <p className="max-w-3xl text-sm leading-relaxed text-mint/80">{edition.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={edition.playlistUrl}
            target="_blank"
            rel="noreferrer"
            className="chip"
          >
            YouTube playlist
          </a>
          {otherEditions.map((other) => (
            <Link
              key={other.id}
              href={`/${other.eventSlug}/${other.villageSlug}`}
              className="chip"
            >
              {other.eventShortName}
              <span className="text-[10px] text-mint/40">{other.talkCount}</span>
            </Link>
          ))}
        </div>
      </header>

      <TalkBrowser
        talks={talks}
        hide={["years", "villages"]}
        topicLabels={getTaxonomy().topicLabels}
        emptyHint="No talks in this village match these filters."
      />
    </div>
  );
}
