"use client";

import Link from "next/link";
import { HUBS } from "@/lib/hubs";

const NAV = [
  { href: "/", label: "All talks" },
  ...HUBS.map((hub) => ({ href: hub.href, label: hub.label })),
  { href: "/tracks", label: "Tracks" },
  { href: "/topics", label: "Topics" },
  { href: "/speakers", label: "Speakers" },
  { href: "/saved", label: "Saved" },
];

function openPalette() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-acid/20 bg-void/90 backdrop-blur max-[599px]:overflow-x-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 py-2 max-[599px]:min-w-0 max-[599px]:flex-nowrap max-[599px]:gap-x-3 sm:px-6">
        <Link href="/" className="group flex items-baseline max-[599px]:shrink-0 gap-3 sm:gap-4">
          <span className="font-display text-base font-bold tracking-[0.14em] text-acid group-hover:text-cyan sm:text-lg">
            CYBER TALKS
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-mint/40 sm:inline">
            archive
          </span>
        </Link>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 max-[599px]:min-w-0 max-[599px]:flex-1">
          <div className="push-nav-clip relative max-[599px]:min-w-0 max-[599px]:flex-1 max-[599px]:overflow-hidden">
            <nav
              aria-label="Primary"
              className="push-nav flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-mint/80 max-[599px]:flex-nowrap max-[599px]:overflow-x-auto max-[599px]:min-w-0 max-[599px]:whitespace-nowrap max-[599px]:py-1 max-[599px]:pr-3"
            >
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="shrink-0 hover:text-cyan">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <button
            type="button"
            onClick={openPalette}
            aria-label="Open command palette (Ctrl+K)"
            className="hidden sm:flex items-center gap-1.5 rounded border border-acid/20 px-2 py-1 font-mono text-[10px] text-mint/40 transition hover:border-acid/50 hover:text-mint/70"
          >
            <span>⌘K</span>
          </button>
        </div>
      </div>
    </header>
  );
}
