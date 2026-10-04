import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import routes from "@/generated/page-routes.json";
import { inDefconVillage, villageEditionPath, villageSeriesPath } from "@/lib/hubs";
import { loadEditionPage } from "@/lib/page-runtime";
import { topicLabels } from "@/lib/topic-labels";

type Props = { params: Promise<{ event: string; village: string }> };

export function generateStaticParams() {
  return routes.editions.map((edition) => ({
    event: edition.event,
    village: edition.village,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { event, village } = await params;
  const page = await loadEditionPage(event, village);
  if (!page) return { title: "Village not found" };
  const { edition } = page;
  return {
    title: `${edition.villageName} — ${edition.eventName}`,
    description: edition.description,
  };
}

export default async function VillageEditionPage({ params }: Props) {
  const { event, village } = await params;
  const page = await loadEditionPage(event, village);
  if (!page) notFound();
  const { edition, series, talks } = page;

  const isVillage = inDefconVillage(edition);
  const otherEditions = series?.editions.filter((item) => item.id !== edition.id) ?? [];

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <p className="eyebrow flex flex-wrap items-center gap-2">
          <Link href={`/${edition.eventSlug}`} className="hover:text-acid">
            {edition.eventName}
          </Link>
          <span className="text-mint/25">/</span>
          {isVillage ? (
            <Link href={villageSeriesPath(edition.villageSlug)} className="hover:text-acid">
              {edition.villageName} across years
            </Link>
          ) : null}
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
              href={villageEditionPath(other)}
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
        hide={isVillage ? ["years", "villages", "conferences"] : ["years", "villages", "conferences"]}
        topicLabels={topicLabels()}
        emptyHint="No talks in this village match these filters."
      />
    </div>
  );
}
