"use client";

import { useState } from "react";
import type { PublicMaterial } from "@/lib/materials";

const ICONS: Record<PublicMaterial["type"], string> = {
  slides: "M6 3h8l4 4v14H6V3zm8 1.5V8h3.5",
  repo: "M9 19c-4 1.5-4-2.5-6-3m12 5v-3.9a3.4 3.4 0 0 0-.9-2.3c3-.3 6.1-1.4 6.1-6.4a4.7 4.7 0 0 0-1.3-3.3 4.4 4.4 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6 0C6.3 2.6 5.3 2.9 5.3 2.9a4.4 4.4 0 0 0-.1 3.2 4.7 4.7 0 0 0-1.3 3.3c0 5 3.1 6.1 6.1 6.4a3.4 3.4 0 0 0-.9 2.3V21",
  paper: "M7 3h7l5 5v13H7V3zm7 1v4h4M9 13h6M9 17h6",
  whitepaper: "M7 3h7l5 5v13H7V3zm7 1v4h4M9 13h6M9 17h4",
  demo: "M8 6.5v11l10-5.5-10-5.5z",
  recording: "M4 7h11v10H4V7zm11 3 5-2v8l-5-2",
  tool: "M14.7 6.3a4 4 0 0 0-5.6 5.6L4 17l3 3 5.1-5.1a4 4 0 0 0 5.6-5.6l-2.8 2.8-2.2-2.2 2-2.6z",
  "speaker-link": "M12 12a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 12zm-6 8.5a6 6 0 0 1 12 0",
  reference: "M7 4h10v16H7z",
  link: "M10 14l4-4M9 15H7a3 3 0 0 1 0-6h2m4 0h2a3 3 0 0 1 0 6h-2",
};

function TypeIcon({ type }: { type: PublicMaterial["type"] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 shrink-0 text-acid/80"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICONS[type] ?? ICONS.link} />
    </svg>
  );
}

function MaterialAnchor({ item }: { item: PublicMaterial }) {
  return (
    <li className="min-w-0">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-11 items-center gap-2 rounded-sm border border-acid/20 bg-void/40 px-3 py-2 text-sm text-mint transition hover:border-cyan hover:text-cyan"
      >
        <TypeIcon type={item.type} />
        <span className="min-w-0 flex-1 break-words">{item.label}</span>
        <span className="meta-chip shrink-0 !normal-case !tracking-normal">{item.source}</span>
      </a>
    </li>
  );
}

export function MaterialsList({
  materials,
  moreMaterials,
}: {
  materials: PublicMaterial[];
  moreMaterials: PublicMaterial[];
}) {
  const [open, setOpen] = useState(false);
  if (materials.length === 0 && moreMaterials.length === 0) return null;

  return (
    <section className="space-y-3" aria-labelledby="materials-heading">
      <h2 id="materials-heading" className="font-display text-xs uppercase tracking-[0.2em] text-acid">
        Materials
      </h2>
      {materials.length > 0 ? (
        <ul className="space-y-2">
          {materials.map((item) => (
            <MaterialAnchor key={item.url} item={item} />
          ))}
        </ul>
      ) : null}
      {moreMaterials.length > 0 ? (
        <div className="space-y-2">
          <button
            type="button"
            className="min-h-11 text-left text-[12px] uppercase tracking-[0.14em] text-cyan hover:text-acid"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide extra links" : `Show more links (${moreMaterials.length})`}
          </button>
          {open ? (
            <ul className="space-y-2">
              {moreMaterials.map((item) => (
                <MaterialAnchor key={item.url} item={item} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
