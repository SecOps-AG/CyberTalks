import Link from "next/link";
import { DC34_BANNER } from "@/lib/dc34";

/** DEF CON 34 announcement strip under the site header. Server-rendered, so it is in the first paint. */
export function SiteBanner() {
  return (
    <div className="relative overflow-hidden border-b border-acid/30 bg-[linear-gradient(90deg,rgba(57,255,20,0.14),rgba(57,255,20,0.04)_45%,rgba(0,240,255,0.08))]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-acid shadow-[0_0_16px_rgba(57,255,20,0.8)]"
      />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-3 sm:flex-nowrap sm:px-6 sm:py-3.5">
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center gap-2 rounded-[3px] border border-acid/70 bg-void/70 px-2.5 py-1 font-display text-xs font-bold tracking-[0.18em] text-acid shadow-glow sm:text-sm"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-acid" />
          DC34
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-[#c8ffc0] sm:text-[15px]">
          {DC34_BANNER.text}
        </p>
        <Link
          href={DC34_BANNER.href}
          className="group inline-flex shrink-0 items-center gap-2 rounded-[3px] border border-cyan/70 bg-cyan/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan transition hover:border-acid hover:bg-acid hover:text-void max-[599px]:w-full max-[599px]:justify-center sm:text-xs"
        >
          {DC34_BANNER.linkLabel}
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5">
            <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
