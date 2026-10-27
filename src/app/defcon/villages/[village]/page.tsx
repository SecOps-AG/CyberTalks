import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import routes from "@/generated/page-routes.json";
import { villageEditionPath } from "@/lib/hubs";
import { loadSeriesPage } from "@/lib/page-runtime";
import { topicLabels } from "@/lib/topic-labels";

type Props = { params: Promise<{ village: string }> };

export function generateStaticParams() {
  return routes.series.map((village) => ({ village }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { village } = await params;
  const page = await loadSeriesPage(village);
  if (!page) return { title: "Village not found" };
  return {
    title: `${page.series.name} — DEF CON`,
    description: page.series.description,
  };
}

export default async function DefconVillageSeriesPage({ params }: Props) {
  const { village } = await params;
  const page = await loadSeriesPage(village);
  if (!page) notFound();
  const { series, talks } = page;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <p className="eyebrow">
          <Link href="/defcon/villages" className="hover:text-acid">
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
              href={villageEditionPath(edition)}
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
        hide={["villages", "conferences"]}
        topicLabels={topicLabels()}
        emptyHint={`No ${series.name} talks match these filters.`}
      />
    </div>
  );
}
