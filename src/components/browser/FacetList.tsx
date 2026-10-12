"use client";

import { useMemo, useState } from "react";
import type { FacetOption } from "@/lib/search";

const COLLAPSED = 8;
const SEARCHABLE_AT = 12;

/**
 * A counted, checkbox-style facet. Long lists collapse to the top few and grow
 * a filter box, so even a long village list stays one short block.
 *
 * `compact` keeps the full count-sorted list in a ~5-row box with its own
 * scrollbar so a long conference list cannot stretch the filter rail.
 */
export function FacetList<T extends string | number>({
  label,
  options,
  selected,
  onToggle,
  collapsedCount = COLLAPSED,
  compact = false,
}: {
  label: string;
  options: FacetOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
  collapsedCount?: number;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [needle, setNeedle] = useState("");

  const searchable = options.length >= SEARCHABLE_AT;

  const matching = useMemo(() => {
    const query = needle.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, needle]);

  // Compact: every matching option stays in the scroll box. Otherwise selected
  // values always stay visible, even below the collapse cut.
  const visible = useMemo(() => {
    if (compact || expanded || needle.trim()) return matching;
    const head = matching.slice(0, collapsedCount);
    const pinned = matching.filter(
      (option) => selected.includes(option.value) && !head.includes(option),
    );
    return [...head, ...pinned];
  }, [compact, matching, expanded, needle, collapsedCount, selected]);

  const hidden = compact ? 0 : matching.length - visible.length;

  if (options.length === 0) return null;

  return (
    <section>
      <p className="label mb-1.5">{label}</p>

      {searchable ? (
        <input
          type="search"
          value={needle}
          onChange={(event) => setNeedle(event.target.value)}
          placeholder={`Filter ${label.toLowerCase()}`}
          aria-label={`Filter ${label.toLowerCase()}`}
          className="field mb-1.5 !py-1 text-[12px]"
        />
      ) : null}

      <div
        className={`scroll-list space-y-0.5 overflow-y-auto pr-1 ${
          compact ? "max-h-36" : "max-h-72"
        }`}
      >
        {visible.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={String(option.value)}
              type="button"
              className="facet"
              data-active={active}
              aria-pressed={active}
              onClick={() => onToggle(option.value)}
            >
              <span className="facet-box" aria-hidden>
                {active ? "×" : ""}
              </span>
              <span className="flex-1 truncate">{option.label}</span>
              <span className="shrink-0 tabular-nums text-[11px] text-mint/40">
                {option.count}
              </span>
            </button>
          );
        })}
        {visible.length === 0 ? (
          <p className="px-1.5 py-1 text-[11px] text-mint/40">No match.</p>
        ) : null}
      </div>

      {hidden > 0 && !needle.trim() ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 px-1.5 text-[11px] text-cyan hover:text-acid"
        >
          Show {hidden} more
        </button>
      ) : null}
      {expanded && !needle.trim() && matching.length > collapsedCount ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-1 px-1.5 text-[11px] text-cyan hover:text-acid"
        >
          Show fewer
        </button>
      ) : null}
    </section>
  );
}
