import type { Metadata } from "next";
import Link from "next/link";
import { getVillageSeries } from "@/lib/data";

export const metadata: Metadata = {
  title: "Villages",
  description: "Every DEF CON village in the archive, across all years.",
};

export default function VillagesPage() {
  const series = getVillageSeries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[0.06em] text-acid">Villages</h1>
        <p className="mt-1 max-w-2xl text-sm text-mint/60">
          A village is tracked across every year it ran. Open one to see its talks from all
          events, or jump to a single year.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {series.map((village) => (
          <article key={village.slug} className="panel flex flex-col gap-3 p-5">
            <div>
              <h2 className="font-display text-base font-semibold text-acid">
                <Link href={`/villages/${village.slug}`} className="hover:text-cyan">
                  {village.name}
                </Link>
              </h2>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-mint/50">
                {village.talkCount} talks · {village.editions.length} event
                {village.editions.length === 1 ? "" : "s"}
              </p>
            </div>
            <p className="line-clamp-3 text-sm leading-relaxed text-mint/75">
              {village.description}
            </p>
            <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
              {village.editions.map((edition) => (
                <Link
                  key={edition.id}
                  href={`/${edition.eventSlug}/${edition.villageSlug}`}
                  className="chip"
                >
                  {edition.eventShortName}
                  <span className="text-[10px] text-mint/40">{edition.talkCount}</span>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
