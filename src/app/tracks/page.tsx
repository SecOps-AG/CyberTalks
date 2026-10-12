import type { Metadata } from "next";
import Link from "next/link";
import { getTrackCounts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Tracks",
  description: "Talks grouped by the kind of work they cover — offense, defense, and domain.",
};

const STANCE_ORDER = ["recon", "offense", "both", "defense", "domain"] as const;
const STANCE_LABEL: Record<string, string> = {
  recon: "Recon",
  offense: "Offense",
  both: "Offense + defense",
  defense: "Defense",
  domain: "Domain",
};

export default function TracksPage() {
  const tracks = getTrackCounts();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[0.06em] text-acid">Tracks</h1>
        <p className="mt-1 max-w-2xl text-sm text-mint/60">
          A track says what kind of work a talk is about. Every talk has exactly one, drawn from a
          fixed vocabulary — unlike topics, which are free-form and many per talk.
        </p>
      </div>

      {STANCE_ORDER.map((stance) => {
        const group = tracks.filter((entry) => entry.track.stance === stance);
        if (group.length === 0) return null;
        return (
          <section key={stance}>
            <h2 className="mb-3 border-b border-acid/15 pb-2 font-display text-xs uppercase tracking-[0.2em] text-cyan">
              {STANCE_LABEL[stance]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map(({ track, count }) => (
                <Link
                  key={track.slug}
                  href={`/tracks/${track.slug}`}
                  className="panel group flex flex-col gap-1.5 p-4 transition hover:border-acid/50"
                >
                  <p className="flex items-baseline justify-between gap-2 font-display text-sm font-semibold text-acid group-hover:text-cyan">
                    {track.name}
                    <span className="text-[11px] tabular-nums text-mint/40">{count}</span>
                  </p>
                  <p className="text-[13px] leading-relaxed text-mint/65">{track.blurb}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
