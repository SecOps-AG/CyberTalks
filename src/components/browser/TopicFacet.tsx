"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FacetOption } from "@/lib/search";

const SUGGESTIONS = 8;
const RESULTS = 10;

/**
 * Topics are the long tail: the vocabulary grows close to linearly with the
 * archive, so it is never rendered as a full list. This renders the current
 * selection, a type-ahead over every topic, and the handful that co-occur with
 * the results on screen.
 */
export function TopicFacet({
  options,
  selected,
  onToggle,
  labelFor,
}: {
  options: FacetOption<string>[];
  selected: string[];
  onToggle: (value: string) => void;
  labelFor: (topic: string) => string;
}) {
  const [needle, setNeedle] = useState("");

  const query = needle.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!query) return [];
    return options
      .filter((option) => option.value.includes(query) && !selected.includes(option.value))
      .slice(0, RESULTS);
  }, [options, query, selected]);

  const suggestions = useMemo(
    () =>
      options
        .filter((option) => !selected.includes(option.value) && option.count > 0)
        .slice(0, SUGGESTIONS),
    [options, selected],
  );

  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="label">Topics</p>
        <Link href="/topics" className="text-[10px] text-cyan hover:text-acid">
          all {options.length}
        </Link>
      </div>

      {selected.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((topic) => (
            <button
              key={topic}
              type="button"
              className="chip"
              data-active
              onClick={() => onToggle(topic)}
              aria-label={`Remove topic ${labelFor(topic)}`}
            >
              {labelFor(topic)}
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
        placeholder="Add a topic…"
        aria-label="Search topics"
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
              <span className="flex-1 truncate">{labelFor(option.value)}</span>
              <span className="shrink-0 tabular-nums text-[11px] text-mint/40">
                {option.count}
              </span>
            </button>
          ))}
          {matches.length === 0 ? (
            <p className="px-1.5 py-1 text-[11px] text-mint/40">No topic matches “{needle}”.</p>
          ) : null}
        </div>
      ) : suggestions.length > 0 ? (
        <>
          <p className="mb-1.5 mt-2 text-[10px] uppercase tracking-[0.16em] text-mint/35">
            Common in these results
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="chip !normal-case !tracking-normal"
                onClick={() => onToggle(option.value)}
              >
                {labelFor(option.value)}
                <span className="text-[10px] text-mint/40">{option.count}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
