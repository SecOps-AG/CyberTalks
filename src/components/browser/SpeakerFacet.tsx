"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FacetOption } from "@/lib/search";

const RESULTS = 10;
const REGULARS = 6;

/**
 * Speakers are the longest tail in the archive: roughly one name per talk, most
 * appearing once. A checkbox list would be an unreadable wall, so this is a
 * type-ahead — the current selection, a search over every name in the results,
 * and the few people credited more than once. Same shape as TopicFacet.
 */
export function SpeakerFacet({
  options,
  selected,
  onToggle,
}: {
  options: FacetOption<string>[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [needle, setNeedle] = useState("");

  const query = needle.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!query) return [];
    return options
      .filter(
        (option) => option.label.toLowerCase().includes(query) && !selected.includes(option.value),
      )
      .slice(0, RESULTS);
  }, [options, query, selected]);

  // Options arrive count-first, so the head is the people with the most talks.
  // Single-talk speakers are left to the search box.
  const regulars = useMemo(
    () =>
      options
        .filter((option) => option.count > 1 && !selected.includes(option.value))
        .slice(0, REGULARS),
    [options, selected],
  );

  const labelFor = (slug: string) =>
    options.find((option) => option.value === slug)?.label ?? slug;

  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="label">Speakers</p>
        <Link href="/speakers" className="text-[10px] text-cyan hover:text-acid">
          all {options.length}
        </Link>
      </div>

      {selected.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((slug) => (
            <button
              key={slug}
              type="button"
              className="chip !normal-case !tracking-normal"
              data-active
              onClick={() => onToggle(slug)}
              aria-label={`Remove speaker ${labelFor(slug)}`}
            >
              {labelFor(slug)}
              <span aria-hidden className="text-[10px]">
                ×
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <input
        type="search"
        value={needle}
        onChange={(event) => setNeedle(event.target.value)}
        placeholder="Find a speaker…"
        aria-label="Search speakers"
        className="field !py-1 text-[12px]"
      />

      {query ? (
        <div className="scroll-list mt-1.5 max-h-56 space-y-0.5 overflow-y-auto pr-1">
          {matches.map((option) => (
            <button
              key={option.value}
              type="button"
              className="facet"
              onClick={() => {
                onToggle(option.value);
                setNeedle("");
              }}
            >
              <span className="flex-1 truncate">{option.label}</span>
              <span className="shrink-0 tabular-nums text-[11px] text-mint/40">
                {option.count}
              </span>
            </button>
          ))}
          {matches.length === 0 ? (
            <p className="px-1.5 py-1 text-[11px] text-mint/40">No speaker matches “{needle}”.</p>
          ) : null}
        </div>
      ) : regulars.length > 0 ? (
        <>
          <p className="mb-1 mt-2 text-[10px] uppercase tracking-[0.16em] text-mint/35">
            More than once
          </p>
          <div className="space-y-0.5">
            {regulars.map((option) => (
              <button
                key={option.value}
                type="button"
                className="facet"
                onClick={() => onToggle(option.value)}
              >
                <span className="flex-1 truncate">{option.label}</span>
                <span className="shrink-0 tabular-nums text-[11px] text-mint/40">
                  {option.count}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
