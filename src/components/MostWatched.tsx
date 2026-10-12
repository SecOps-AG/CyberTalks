import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import { conferenceLabel, formatViews } from "@/lib/labels";
import type { Talk } from "@/lib/types";

/** Latest fetch time across the rail, as "17 Sep 2026". */
function asOf(talks: Talk[]): string | null {
  const latest = talks
    .map((talk) => Date.parse(talk.viewCountFetchedAt ?? ""))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  if (!latest) return null;
  return new Date(latest).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A horizontal rail of the archive's most-viewed talks, ranked by YouTube view count. */
export function MostWatched({ talks }: { talks: Talk[] }) {
  if (talks.length === 0) return null;
  const fetched = asOf(talks);

  return (
    <section aria-label="Most watched talks">
      <SectionHeading
        title="Most Watched"
        hint={fetched ? `Ranked by YouTube views · as of ${fetched}` : "Ranked by YouTube views"}
      />

      <ol className="scroll-list -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
        {talks.map((talk, index) => (
          <li key={talk.id} className="w-60 shrink-0 snap-start sm:w-64">
            <Link
              href={`/talks/${talk.slug}`}
              className="panel group flex h-full flex-col overflow-hidden transition hover:border-acid/50"
            >
              <div className="relative overflow-hidden bg-black">
                <img
                  src={`https://i.ytimg.com/vi/${talk.youtubeId}/mqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="aspect-video w-full object-cover opacity-75 transition group-hover:opacity-100"
                />
                <span className="absolute left-2 top-2 font-display text-2xl font-bold leading-none text-acid drop-shadow-[0_0_6px_rgba(5,8,5,0.9)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="absolute bottom-2 right-2 rounded-sm border border-acid/40 bg-void/90 px-1.5 py-0.5 font-mono text-[10px] text-acid">
                  {formatViews(talk.viewCount ?? 0)} views
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="flex flex-wrap gap-1.5">
                  <span className="meta-chip border-acid/35 text-acid/90">
                    {conferenceLabel(talk.conference)}
                  </span>
                  <span className="meta-chip">{talk.dateLabel}</span>
                </p>
                <h3 className="line-clamp-3 font-display text-[13px] font-semibold leading-snug text-mint group-hover:text-cyan">
                  {talk.title}
                </h3>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
