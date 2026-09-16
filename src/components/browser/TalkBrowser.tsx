"use client";

import type { ReactNode } from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { TalkCard } from "@/components/TalkCard";
import { FacetList } from "@/components/browser/FacetList";
import { Pagination } from "@/components/browser/Pagination";
import { SpeakerFacet } from "@/components/browser/SpeakerFacet";
import { TopicFacet } from "@/components/browser/TopicFacet";
import {
  computeFacets,
  countActive,
  EMPTY_FILTERS,
  filtersFromParams,
  filtersToQuery,
  filterTalks,
  mergeSummaries,
  paginate,
  queryTerms,
  sortTalks,
  toggleValue,
  withHaystack,
  type Filters,
  type SortKey,
} from "@/lib/search";
import type { TalkIndexEntry, TalkSummaryEntry } from "@/lib/types";

type Dimension = "years" | "villages" | "tracks" | "speakers" | "lengths";

export type TalkBrowserProps = {
  talks: TalkIndexEntry[];
  /** Facets to leave out because the page itself already pins them. */
  hide?: Dimension[];
  topicLabels?: Record<string, string>;
  /** Off for embedded browsers so a village page does not fight for the URL. */
  syncUrl?: boolean;
  emptyHint?: string;
  /** Rendered above the search field — the page's own framing. */
  masthead?: ReactNode;
  /** "lg" gives the search field top billing; "md" keeps it inline. */
  size?: "md" | "lg";
  /** One-click starter queries, shown only while the field is empty. */
  examples?: string[];
  searchPlaceholder?: string;
};

const SORTS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "duration", label: "Duration" },
  { value: "title", label: "Title" },
  { value: "village", label: "Village" },
];

export function TalkBrowser({
  talks,
  hide = [],
  topicLabels = {},
  syncUrl = true,
  emptyHint = "No talks match these filters.",
  masthead,
  size = "md",
  examples = [],
  searchPlaceholder = "Search titles, speakers, villages, topics…",
}: TalkBrowserProps) {
  // `q` deliberately lives outside `filters`. If a keystroke updated `filters`,
  // every downstream memo would recompute on the urgent render *and* again on
  // the deferred one; keeping it separate means typing recomputes nothing until
  // the deferred value catches up.
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draftQuery, setDraftQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [summaries, setSummaries] = useState<Map<string, string>>(new Map());
  const resultsRef = useRef<HTMLDivElement>(null);

  const hasExtras = useMemo(() => talks.some((t) => t.kind !== "talk"), [talks]);
  const allExtras = useMemo(() => talks.length > 0 && talks.every((t) => t.kind !== "talk"), [talks]);

  // Read deep-linked state after mount rather than during render: the page is
  // statically rendered, so reading the URL in the initial state would mismatch.
  useEffect(() => {
    if (syncUrl) {
      const params = new URLSearchParams(window.location.search);
      if ([...params.keys()].length > 0) {
        const parsed = filtersFromParams(params);
        setFilters(parsed);
        setDraftQuery(parsed.q);
      } else if (allExtras) {
        setFilters((f) => ({ ...f, includeExtras: true }));
      }
    } else if (allExtras) {
      setFilters((f) => ({ ...f, includeExtras: true }));
    }
    setReady(true);
  }, [syncUrl, allExtras]);

  // Load per-year summary shards in the background. This enriches search without
  // blocking initial render. Each year's shard is fetched independently.
  useEffect(() => {
    const years = new Set(talks.map((talk) => talk.year));
    const allSummaries = new Map<string, string>();

    const loadYearShard = async (year: number) => {
      try {
        const res = await fetch(`/data/summaries/summaries-${year}.json`);
        if (!res.ok) return;
        const entries: TalkSummaryEntry[] = await res.json();
        for (const entry of entries) {
          if (entry.summary) {
            allSummaries.set(entry.id, entry.summary);
          }
        }
        setSummaries((prev) => new Map([...prev, ...allSummaries]));
      } catch {
        // Silently fail if shards are not available
      }
    };

    for (const year of years) {
      loadYearShard(year);
    }
  }, [talks]);

  // Typing stays responsive at thousands of talks: the list lags a frame, the input never does.
  const deferredQuery = useDeferredValue(draftQuery);
  const effective = useMemo<Filters>(
    () => ({ ...filters, q: deferredQuery }),
    [filters, deferredQuery],
  );

  // A new query is a new result set, so it goes back to page 1.
  useEffect(() => {
    setFilters((current) => (current.page === 1 ? current : { ...current, page: 1 }));
  }, [deferredQuery]);

  // Keep the URL shareable without pushing a history entry per keystroke.
  // `ready` is state, not a ref, so this cannot run before hydration has landed
  // and blank out the very params it just read.
  useEffect(() => {
    if (!syncUrl || !ready) return;
    const query = filtersToQuery({ ...filters, q: draftQuery });
    const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", next);
    }
  }, [filters, draftQuery, syncUrl, ready]);

  // Search text is derived here rather than shipped: see withHaystack.
  // Summaries are merged in when available, enriching the haystack without blocking initial render.
  const searchable = useMemo(() => {
    const base = withHaystack(talks);
    if (summaries.size === 0) return base;
    const terms = queryTerms(draftQuery);
    return mergeSummaries(base, summaries, terms);
  }, [talks, summaries, draftQuery]);

  const facets = useMemo(() => computeFacets(searchable, effective), [searchable, effective]);
  const filtered = useMemo(() => filterTalks(searchable, effective), [searchable, effective]);
  const sorted = useMemo(
    () => sortTalks(filtered, effective.sort, effective.q),
    [filtered, effective.sort, effective.q],
  );
  const paged = useMemo(() => paginate(sorted, effective.page), [sorted, effective.page]);

  const update = useCallback((patch: Partial<Filters>) => {
    // Any change to the result set sends you back to page 1.
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setFilters((current) => ({ ...current, page }));
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const labelFor = useCallback(
    (topic: string) => topicLabels[topic] ?? topic,
    [topicLabels],
  );

  const activeCount = countActive({ ...filters, q: draftQuery });

  const clearAll = () => {
    setDraftQuery("");
    setFilters({ ...EMPTY_FILTERS, includeExtras: allExtras, sort: filters.sort });
  };

  const renderPanel = () => (
    <div className="space-y-5">
      {hasExtras ? (
        <div className="border-b border-acid/15 pb-4">
          <label className="flex cursor-pointer select-none items-center gap-2 text-[12px] text-mint/80 transition hover:text-acid">
            <input
              type="checkbox"
              checked={filters.includeExtras}
              onChange={(e) => update({ includeExtras: e.target.checked })}
              className="rounded-sm border border-acid/40 bg-void accent-cyan"
            />
            <span>Include clips &amp; extras</span>
          </label>
        </div>
      ) : null}
      {!hide.includes("years") ? (
        <FacetList
          label="Year"
          options={facets.years}
          selected={filters.years}
          onToggle={(value) => update({ years: toggleValue(filters.years, value) })}
        />
      ) : null}
      {!hide.includes("lengths") ? (
        <FacetList
          label="Length"
          options={facets.lengths}
          selected={filters.lengths}
          onToggle={(value) => update({ lengths: toggleValue(filters.lengths, value) })}
        />
      ) : null}
      {!hide.includes("villages") ? (
        <FacetList
          label="Village"
          options={facets.villages}
          selected={filters.villages}
          onToggle={(value) => update({ villages: toggleValue(filters.villages, value) })}
        />
      ) : null}
      {!hide.includes("tracks") ? (
        <FacetList
          label="Track"
          options={facets.tracks}
          selected={filters.tracks}
          onToggle={(value) => update({ tracks: toggleValue(filters.tracks, value) })}
        />
      ) : null}
      <TopicFacet
        options={facets.topics}
        selected={filters.topics}
        onToggle={(value) => update({ topics: toggleValue(filters.topics, value) })}
        labelFor={labelFor}
      />
      {!hide.includes("speakers") ? (
        <SpeakerFacet
          options={facets.speakers}
          selected={filters.speakers}
          onToggle={(value) => update({ speakers: toggleValue(filters.speakers, value) })}
        />
      ) : null}
    </div>
  );

  const large = size === "lg";

  const search = (
    <div>
      <div
        className={`panel flex items-center gap-3 transition focus-within:border-cyan/60 ${
          large ? "px-4 py-3.5 sm:px-5 sm:py-4" : "p-3 sm:p-4"
        }`}
      >
        <label htmlFor="talk-search" className="sr-only">
          Search talks
        </label>
        <span aria-hidden className={`text-acid/70 ${large ? "text-lg" : ""}`}>
          &gt;
        </span>
        <input
          id="talk-search"
          type="search"
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          placeholder={searchPlaceholder}
          className={`w-full bg-transparent font-mono text-mint outline-none placeholder:text-mint/30 ${
            large ? "text-base sm:text-lg" : "text-sm"
          }`}
        />
      </div>

      {examples.length > 0 && !draftQuery ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-mint/40">
          <span className="uppercase tracking-[0.18em]">try</span>
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setDraftQuery(example)}
              className="text-cyan underline-offset-4 transition hover:text-acid hover:underline"
            >
              {example}
            </button>
          ))}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      {masthead ? <div key="masthead">{masthead}</div> : null}

      {/* Search comes first; the facet rail refines from there. */}
      {search ? <div key="search">{search}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        {/* Desktop rail: own overflow so it can scroll without waiting out the results list. */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-5.5rem)] space-y-5 overflow-y-auto overscroll-contain scroll-list pr-1">
            <div className="flex items-center justify-between">
              <p className="font-display text-xs uppercase tracking-[0.2em] text-acid">Filters</p>
              {activeCount > 0 ? (
                <button type="button" onClick={clearAll} className="text-[11px] text-mag hover:text-acid">
                  Clear {activeCount}
                </button>
              ) : null}
            </div>
            {renderPanel()}
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          {/* Mobile facets */}
          <details open className="panel group lg:hidden">
            <summary className="cursor-pointer list-none px-4 py-3 font-display text-xs uppercase tracking-[0.2em] text-acid">
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
              <span className="float-right text-mint/50 group-open:hidden">+</span>
              <span className="float-right hidden text-mint/50 group-open:inline">−</span>
            </summary>
            <div className="border-t border-acid/15 p-4">{renderPanel()}</div>
          </details>

          <div
            ref={resultsRef}
            className="flex flex-wrap items-center justify-between gap-3 scroll-mt-24"
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-mint/60">
              {paged.total === 0
                ? "0 talks"
                : `${paged.from}–${paged.to} of ${paged.total} talk${paged.total === 1 ? "" : "s"}`}
              {paged.total !== talks.length ? (
                <span className="text-mint/30"> / {talks.length}</span>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {hasExtras ? (
                <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-mint/70 transition hover:text-acid">
                  <input
                    type="checkbox"
                    checked={filters.includeExtras}
                    onChange={(e) => update({ includeExtras: e.target.checked })}
                    className="rounded-sm border border-acid/40 bg-void accent-cyan"
                  />
                  <span>Clips &amp; extras</span>
                </label>
              ) : null}
              {activeCount > 0 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] uppercase tracking-[0.14em] text-mag hover:text-acid lg:hidden"
                >
                  Clear
                </button>
              ) : null}
              <div className="flex items-center gap-2">
                <label htmlFor="talk-sort" className="label">
                  Sort
                </label>
                <select
                  id="talk-sort"
                  value={filters.sort}
                  onChange={(event) => update({ sort: event.target.value as SortKey })}
                  className="rounded-sm border border-acid/25 bg-void px-2 py-1 font-mono text-[11px] text-mint outline-none focus:border-cyan"
                >
                  {SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {paged.items.length === 0 ? (
            <div className="panel px-4 py-12 text-center">
              <p className="text-sm uppercase tracking-[0.16em] text-warn">{emptyHint}</p>
              {activeCount > 0 ? (
                <button type="button" onClick={clearAll} className="link mt-4 text-[11px] uppercase">
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paged.items.map((talk) => (
                <TalkCard key={talk.id} talk={talk} />
              ))}
            </div>
          )}

          <Pagination page={paged.page} totalPages={paged.totalPages} onChange={goToPage} />
          </div>
      </div>
    </div>
  );
}
