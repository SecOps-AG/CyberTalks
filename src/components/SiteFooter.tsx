import Link from "next/link";
import { getStats } from "@/lib/data";

export function SiteFooter() {
  const stats = getStats();

  return (
    <footer className="border-t border-acid/15 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-3">
        <p className="max-w-3xl text-[12px] leading-relaxed text-mint/55">
          An unofficial archive, not affiliated with or endorsed by DEF CON or the Dark
          Tangent.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.16em] text-mint/50">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span>{stats.talks} talks</span>
            <span>{stats.speakers} speakers</span>
            <span>{stats.villages} villages</span>
            <span>{stats.events} events</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/" className="hover:text-cyan">
              Browse
            </Link>
            <Link href="/topics" className="hover:text-cyan">
              Topics
            </Link>
            <Link href="/speakers" className="hover:text-cyan">
              Speakers
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
