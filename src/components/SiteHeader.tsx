"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HUBS } from "@/lib/hubs";

type NavItem = { href: string; label: string; highlight?: boolean };
type NavGroup = { label: string; accent?: boolean; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Conferences",
    items: [
      { href: "/", label: "All talks" },
      ...HUBS.map((hub) => ({ href: hub.href, label: hub.label })),
    ],
  },
  {
    label: "Learn",
    accent: true,
    items: [
      { href: "/tracks", label: "Tracks" },
      { href: "/skill-tree", label: "Skill Tree", highlight: true },
    ],
  },
  {
    label: "Browse",
    items: [
      { href: "/topics", label: "Topics" },
      { href: "/speakers", label: "Speakers" },
      { href: "/saved", label: "Saved" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TreeIcon() {
  return (
    <svg
      aria-hidden="true"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="4" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 6v5M12 11l-6 6M12 11l6 6" />
    </svg>
  );
}

function navItemClass(item: NavItem, active: boolean) {
  const base = "flex items-center gap-1.5 rounded-sm px-2 py-1 transition";
  if (item.highlight) {
    return `${base} border border-cyan/55 bg-cyan/10 text-cyan hover:bg-cyan/20${
      active ? " bg-cyan/20" : ""
    }`;
  }
  if (active) return `${base} bg-acid/15 text-acid ring-1 ring-inset ring-acid/60`;
  return `${base} hover:bg-acid/10 hover:text-cyan`;
}

function openPalette() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
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
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1.5 max-[599px]:min-w-0 max-[599px]:items-center">
          <nav
            aria-label="Primary"
            className="push-nav flex flex-wrap items-end gap-x-3 gap-y-1.5 text-[11px] uppercase tracking-[0.14em] text-mint/80 max-[599px]:flex-nowrap max-[599px]:items-center max-[599px]:gap-x-2 max-[599px]:overflow-x-auto max-[599px]:min-w-0 max-[599px]:whitespace-nowrap max-[599px]:py-1"
          >
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="flex shrink-0 flex-col gap-1">
                <span
                  className={`hidden pl-0.5 text-[9px] tracking-[0.28em] sm:block ${
                    group.accent ? "text-cyan/75" : "text-mint/55"
                  }`}
                >
                  {group.label}
                </span>
                <div
                  className={`flex items-center gap-0.5 rounded-[3px] border p-[3px] ${
                    group.accent ? "border-cyan/35 bg-cyan/[0.04]" : "border-acid/20 bg-acid/[0.03]"
                  }`}
                >
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={navItemClass(item, active)}
                      >
                        {item.highlight ? <TreeIcon /> : null}
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <button
            type="button"
            onClick={openPalette}
            aria-label="Open command palette (Ctrl+K)"
            className="hidden sm:flex items-center gap-1.5 rounded border border-acid/20 px-2 py-[9px] font-mono text-[10px] text-mint/40 transition hover:border-acid/50 hover:text-mint/70"
          >
            <span>⌘K</span>
          </button>
        </div>
      </div>
    </header>
  );
}
