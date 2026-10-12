import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import type { Track } from "@/lib/types";

/**
 * Talks per track as plain HTML bars — no chart library. One series, so one
 * color; every bar carries its count, and each row links to the track page.
 */
export function TrackChart({ counts }: { counts: { track: Track; count: number }[] }) {
  if (counts.length === 0) return null;
  const max = Math.max(...counts.map((entry) => entry.count));
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <section aria-label="Talks by track">
      <SectionHeading
        title="By Track"
        hint={`${total.toLocaleString("en-US")} talks across ${counts.length} tracks`}
        href="/tracks"
        hrefLabel="All tracks"
      />

      <ul className="grid gap-x-8 gap-y-1 md:grid-cols-2">
        {counts.map(({ track, count }) => {
          const share = ((count / total) * 100).toFixed(1);
          return (
            <li key={track.slug}>
              <Link
                href={`/tracks/${track.slug}`}
                title={`${track.name}: ${count.toLocaleString("en-US")} talks (${share}%)`}
                className="group grid grid-cols-[8.5rem_minmax(0,1fr)_3rem] items-center gap-3 rounded-sm px-1.5 py-1 transition hover:bg-acid/5 sm:grid-cols-[10rem_minmax(0,1fr)_3rem]"
              >
                <span className="truncate text-[11px] uppercase tracking-[0.12em] text-mint/75 group-hover:text-cyan">
                  {track.name}
                </span>
                <span aria-hidden className="block h-2.5 bg-acid/5">
                  <span
                    className="block h-full rounded-r-[4px] bg-acid/60 transition group-hover:bg-acid"
                    style={{ width: `${Math.max((count / max) * 100, 1)}%` }}
                  />
                </span>
                <span className="text-right font-mono text-[11px] tabular-nums text-mint/60 group-hover:text-acid">
                  {count.toLocaleString("en-US")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
