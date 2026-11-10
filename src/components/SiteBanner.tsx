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
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-3 max-[599px]:flex-nowrap max-[599px]:gap-x-3 max-[599px]:py-2 sm:flex-nowrap sm:px-6 sm:py-3.5">
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center gap-2 rounded-[3px] border border-acid/70 max-[599px]:hidden bg-void/70 px-2.5 py-1 font-display text-xs font-bold tracking-[0.18em] text-acid shadow-glow sm:text-sm"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-acid" />
          <span className="after:content-['DC34']" />
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-[#c8ffc0] max-[599px]:text-xs sm:text-[15px]">
          {DC34_BANNER.text}
        </p>{" "}
        <Link
          href={DC34_BANNER.href}
          className="inline-flex shrink-0 items-center gap-2 after:content-['→'] after:transition hover:after:translate-x-0.5 rounded-[3px] border border-cyan/70 bg-cyan/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan transition hover:border-acid hover:bg-acid hover:text-void max-[599px]:min-h-11 max-[599px]:w-[8.25rem] max-[599px]:justify-center max-[599px]:gap-1.5 max-[599px]:px-2 max-[599px]:text-center max-[599px]:leading-tight max-[599px]:tracking-[0.1em] sm:text-xs"
        >
          {DC34_BANNER.linkLabel}
        </Link>
      </div>
    </div>
  );
}
