"use client";

import Link from "next/link";
import { HUBS } from "@/lib/hubs";

const NAV = [
  { href: "/", label: "All talks" },
  ...HUBS.map((hub) => ({ href: hub.href, label: hub.label })),
  { href: "/tracks", label: "Tracks" },
  { href: "/skill-tree", label: "Skill Tree" },
  { href: "/topics", label: "Topics" },
  { href: "/speakers", label: "Speakers" },
  { href: "/saved", label: "Saved" },
];

function openPalette() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-acid/20 bg-void/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 py-2.5 max-[599px]:flex-nowrap sm:py-3 max-[599px]:gap-x-3 sm:px-6">
        <Link
          href="/"
          aria-label="Cyber Talks home"
          className="group flex items-center gap-2.5 max-[599px]:shrink-0 sm:gap-3"
        >
          <span
            aria-hidden="true"
            className="relative grid h-8 w-8 place-items-center rounded-[3px] border border-acid/60 bg-acid/10 font-mono text-[13px] font-semibold leading-none text-acid shadow-glow transition group-hover:border-cyan group-hover:text-cyan sm:h-10 sm:w-10 sm:text-base"
          >
            &gt;_
            <span className="absolute -right-[3px] -top-[3px] h-1.5 w-1.5 bg-cyan" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-xl font-bold tracking-[0.12em] text-acid [text-shadow:0_0_14px_rgba(57,255,20,0.45)] group-hover:text-cyan sm:text-[1.65rem]">
              CYBER TALKS
            </span>
            <span className="mt-1 hidden text-[10px] uppercase tracking-[0.32em] text-mint/50 sm:block">
              conference talk archive
            </span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 max-[599px]:min-w-0">
          <nav
            aria-label="Primary"
            className="push-nav flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-mint/80 max-[599px]:flex-nowrap max-[599px]:overflow-x-auto max-[599px]:min-w-0 max-[599px]:whitespace-nowrap max-[599px]:py-1"
          >
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-cyan">
                {item.label}
              </Link>
            ))}
          </nav>
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
