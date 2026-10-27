"use client";

import type { ReactNode } from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TalkCard } from "@/components/TalkCard";
import { FacetList } from "@/components/browser/FacetList";
import { Pagination } from "@/components/browser/Pagination";
import { SpeakerFacet } from "@/components/browser/SpeakerFacet";
import { TopicFacet } from "@/components/browser/TopicFacet";
import { PushFilters, type PushSection } from "@/components/push/PushFilters";
import { usePush } from "@/components/push/PushPage";
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
import { fetchListingTalks, type ListingKind } from "@/lib/fetch-listing";
import { inDefconVillage } from "@/lib/hubs";
import { fetchAdditionalTalkIndexChunks } from "@/lib/fetch-talk-index";
import { archiveSearchHref } from "@/lib/search-index/href";
import type { TalkIndexEntry, TalkSummaryEntry } from "@/lib/types";

type Dimension =
  | "conferences"
  | "years"
  | "villages"
  | "tracks"
  | "speakers"
  | "lengths"
  | "difficulties";

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
  /**
   * Rendered below the results and pagination — home's rails and charts.
   * Hidden once a query or filter is active, so they never compete with results.
   */
  footer?: ReactNode;
  /** Set the masthead and search together in one hero block, search inside it. */
  hero?: boolean;
  /** "lg" gives the search field top billing; "md" keeps it inline. */
  size?: "md" | "lg";
  /** One-click starter queries, shown only while the field is empty. */
  examples?: string[];
  searchPlaceholder?: string;
  /**
   * Keep the Difficulty facet on screen even when no talks are classified
   * (homepage). Other pages still hide an empty list.
   */
  alwaysShowDifficulties?: boolean;
  /**
   * When true, ignore the initial `talks` prop for data and load the full
   * catalog from /data/talk-index/ year shards on the client (newest first).
   * Keeps SSR HTML thin for homepage/saved.
   */
  remoteIndex?: boolean;
  /**
   * Below 600px, replace the inline filter drawer with the off-canvas push
   * panel (staged picks, applied on "Show N talks"). Homepage only.
   */
  pushFilters?: boolean;
  /**
   * Fetch the full list after first paint. `talks` is only the first page, so
   * topic, track, and speaker documents stay small.
   */
  listing?: { kind: ListingKind; key: string };
  /** Unfiltered talk count, shown before `listing` finishes loading. */
  catalogSize?: number;
  /** Default-filter result count, shown before `listing` finishes loading. */
  resultSize?: number;
  /** Homepage: Enter and "see all results" open the shareable /search page. */
  linkArchiveSearch?: boolean;
};

const SORTS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "views", label: "View count" },
  { value: "duration", label: "Duration" },
  { value: "title", label: "Title" },
  { value: "village", label: "Village" },
];

export function TalkBrowser({
  talks: talksProp,
  hide = [],
  topicLabels = {},
  syncUrl = true,
  emptyHint = "No talks match these filters.",
  masthead,
  footer,
  hero = false,
  size = "md",
  examples = [],
  searchPlaceholder = "Search titles, speakers, villages, topics…",
  alwaysShowDifficulties = false,
  remoteIndex = false,
  pushFilters = false,
  listing,
  catalogSize,
  resultSize,
  linkArchiveSearch = false,
}: TalkBrowserProps) {
  const router = useRouter();
  // `q` deliberately lives outside `filters`. If a keystroke updated `filters`,
  // every downstream memo would recompute on the urgent render *and* again on
  // the deferred one; keeping it separate means typing recomputes nothing until
  // the deferred value catches up.
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draftQuery, setDraftQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [summaries, setSummaries] = useState<Map<string, string>>(new Map());
  const resultsRef = useRef<HTMLDivElement>(null);
  const [remoteTalks, setRemoteTalks] = useState<TalkIndexEntry[]>([]);
  const [catalogReady, setCatalogReady] = useState(!remoteIndex);
  const [catalogLoading, setCatalogLoading] = useState(remoteIndex);
  const [listedTalks, setListedTalks] = useState<TalkIndexEntry[] | null>(null);
  const [listReady, setListReady] = useState(!listing);
  const loadedChunkFilesRef = useRef<Set<string>>(new Set());
  const remoteTalksRef = useRef<TalkIndexEntry[]>([]);
  remoteTalksRef.current = remoteTalks;

  // Phone push panel: picks land in `staged` and only reach `filters` on Apply.
  const pushContext = usePush();
  const push = pushFilters ? pushContext : null;
  const pushOpen = push?.open ?? false;
  const [staged, setStaged] = useState<Filters | null>(null);
  const pushBarRef = useRef<HTMLButtonElement>(null);
  const pushOpenerRef = useRef<HTMLElement | null>(null);
  const scrollAfterPushRef = useRef(false);

  // While staging, also fetch what the staged years/conferences need so the
  // Apply count is honest. Hints only ever widen (empty = everything), so a
  // staged pick never cuts short a full-catalog load already under way.
  const widen = <T,>(applied: T[], next: T[]) =>
    applied.length === 0 || next.length === 0 ? [] : [...new Set([...applied, ...next])];
  const hintYears = staged ? widen(filters.years, staged.years) : filters.years;
  const hintConferences = staged
    ? widen(filters.conferences, staged.conferences)
    : filters.conferences;
  const yearFilterKey = hintYears.join(",");
  const conferenceFilterKey = hintConferences.join(",");

  useEffect(() => {
    if (!remoteIndex || !ready) return;
    let cancelled = false;
    const controller = new AbortController();

    setCatalogLoading(true);

    fetchAdditionalTalkIndexChunks({
      years: hintYears.length > 0 ? hintYears : undefined,
      conferences: hintConferences.length > 0 ? hintConferences : undefined,
      loadedFiles: loadedChunkFilesRef.current,
      existingTalks: remoteTalksRef.current,
      signal: controller.signal,
      onChunk: (talks, meta) => {
        if (cancelled) return;
        if (meta.file) loadedChunkFilesRef.current.add(meta.file);
        setRemoteTalks(talks);
        setCatalogReady(true);
        setCatalogLoading(!meta.complete);
      },
    })
      .then(({ talks, loadedFiles }) => {
        if (cancelled) return;
        for (const file of loadedFiles) loadedChunkFilesRef.current.add(file);
        setRemoteTalks(talks);
        setCatalogReady(true);
        setCatalogLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogReady(true);
        setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [remoteIndex, ready, yearFilterKey, conferenceFilterKey]);

  const listingKind = listing?.kind;
  const listingKey = listing?.key;

  useEffect(() => {
    if (!listingKind || !listingKey) return;
    let cancelled = false;
    const controller = new AbortController();
    setListReady(false);

    fetchListingTalks(listingKind, listingKey, controller.signal)
      .then((next) => {
        if (cancelled) return;
        if (next.length > 0) setListedTalks(next);
        setListReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof Error && error.name === "AbortError") return;
        setListReady(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [listingKind, listingKey]);

  const talks = remoteIndex ? remoteTalks : (listedTalks ?? talksProp);
  const listingPending = Boolean(listing) && !listReady;

  const hasExtras = useMemo(() => talks.some((t) => t.kind !== "talk"), [talks]);
  const allExtras = useMemo(() => talks.length > 0 && talks.every((t) => t.kind !== "talk"), [talks]);
  // Village sort is DEF CON-only: hide it on the homepage and other non-village browsers.
  const sortOptions = useMemo(() => {
    const hideVillage = hide.includes("villages") || !talks.some((talk) => inDefconVillage(talk));
    return hideVillage ? SORTS.filter((option) => option.value !== "village") : SORTS;
  }, [hide, talks]);

  useEffect(() => {
    if (!sortOptions.some((option) => option.value === filters.sort)) {
      setFilters((current) => (current.sort === "relevance" ? current : { ...current, sort: "relevance" }));
    }
  }, [sortOptions, filters.sort]);

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
        const res = await fetch(`/api/summaries/${year}`, { cache: "no-store" });
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

  const facets = useMemo(
    () => computeFacets(searchable, effective, { alwaysShowDifficulties }),
    [searchable, effective, alwaysShowDifficulties],
  );
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
  const pendingUnfiltered = listingPending && activeCount === 0 && resultSize != null;
  const shownTotal = pendingUnfiltered ? resultSize : paged.total;
  const shownFrom = pendingUnfiltered ? (resultSize === 0 ? 0 : 1) : paged.from;
  const shownTo = pendingUnfiltered ? Math.min(paged.items.length, resultSize ?? 0) : paged.to;
  const universe = listingPending && catalogSize != null ? catalogSize : talks.length;

  const stagedEffective = useMemo<Filters | null>(
    () => (staged ? { ...staged, q: deferredQuery } : null),
    [staged, deferredQuery],
  );
  const stagedFacets = useMemo(
    () =>
      stagedEffective
        ? computeFacets(searchable, stagedEffective, { alwaysShowDifficulties })
        : null,
    [searchable, stagedEffective, alwaysShowDifficulties],
  );
  const stagedCount = useMemo(
    () => (stagedEffective ? filterTalks(searchable, stagedEffective).length : 0),
    [searchable, stagedEffective],
  );

  const stage = useCallback((patch: Partial<Filters>) => {
    setStaged((current) => (current ? { ...current, ...patch } : current));
  }, []);

  // Every opening starts from what is applied: closing without Apply discards.
  // Focus goes back to whichever control opened the panel (bar or edge tab).
  const preparePush = () => setStaged(filters);
  const openPush = (opener: HTMLElement | null) => {
    pushOpenerRef.current = opener;
    setStaged(filters);
    push?.setOpen(true);
  };
  const setPushOpen = push?.setOpen;
  const closePush = useCallback(() => setPushOpen?.(false), [setPushOpen]);
  // Leaving the page (e.g. browser back) must not strand the layout pushed aside.
  useEffect(() => closePush, [closePush]);
  const applyPush = () => {
    if (staged) setFilters({ ...staged, sort: filters.sort, page: 1 });
    scrollAfterPushRef.current = true;
    push?.setOpen(false);
  };
  // Once the page has slid home, bring the new results up unless they already lead the screen.
  const onPushClosed = () => {
    setStaged(null);
    if (!scrollAfterPushRef.current) return;
    scrollAfterPushRef.current = false;
    const results = resultsRef.current;
    if (!results) return;
    const top = results.getBoundingClientRect().top;
    if (top >= 0 && top < window.innerHeight / 3) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    results.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };
  const resetPush = () =>
    setStaged((current) =>
      current ? { ...EMPTY_FILTERS, includeExtras: allExtras, sort: current.sort } : current,
    );

  if (remoteIndex && !catalogReady) {
    return (
      <div className="space-y-6">
        {masthead ? <div className={hero ? "" : "mb-2"}>{masthead}</div> : null}
        <p className="py-12 text-center text-sm text-mint/40">Loading catalog…</p>
      </div>
    );
  }


  const clearAll = () => {
    setDraftQuery("");
    setFilters({ ...EMPTY_FILTERS, includeExtras: allExtras, sort: filters.sort });
  };

  const renderPanel = () => (
    <div className="space-y-5">
      {listingPending ? (
        <p className="text-[12px] text-mint/40">Loading filters…</p>
      ) : (
      <>
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
      {/* A page that is all one conference (an event, a village) has nothing to pick. */}
      {!hide.includes("conferences") &&
      (facets.conferences.length > 1 || filters.conferences.length > 0) ? (
        <FacetList
          label="Conference"
          options={facets.conferences}
          selected={filters.conferences}
          onToggle={(value) => update({ conferences: toggleValue(filters.conferences, value) })}
          compact
        />
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
      {!hide.includes("difficulties") ? (
        <FacetList
          label="Difficulty"
          options={facets.difficulties}
          selected={filters.difficulties}
          onToggle={(value) => update({ difficulties: toggleValue(filters.difficulties, value) })}
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
      </>
      )}
    </div>
  );

  const pushSections = (): PushSection[] => {
    if (!staged || !stagedFacets) return [];
    const f = staged;
    const fc = stagedFacets;
    const sections: PushSection[] = [];
    if (!hide.includes("conferences") && (fc.conferences.length > 1 || f.conferences.length > 0)) {
      sections.push({
        id: "conferences",
        label: "Conference",
        selected: f.conferences.length,
        content: (
          <FacetList
            bare
            label="Conference"
            options={fc.conferences}
            selected={f.conferences}
            onToggle={(value) => stage({ conferences: toggleValue(f.conferences, value) })}
          />
        ),
      });
    }
    if (!hide.includes("years")) {
      sections.push({
        id: "years",
        label: "Year",
        selected: f.years.length,
        content: (
          <FacetList
            bare
            label="Year"
            options={fc.years}
            selected={f.years}
            onToggle={(value) => stage({ years: toggleValue(f.years, value) })}
          />
        ),
      });
    }
    if (!hide.includes("lengths")) {
      sections.push({
        id: "lengths",
        label: "Length",
        selected: f.lengths.length,
        content: (
          <FacetList
            bare
            label="Length"
            options={fc.lengths}
            selected={f.lengths}
            onToggle={(value) => stage({ lengths: toggleValue(f.lengths, value) })}
          />
        ),
      });
    }
    if (!hide.includes("difficulties")) {
      sections.push({
        id: "difficulties",
        label: "Difficulty",
        selected: f.difficulties.length,
        content: (
          <FacetList
            bare
            label="Difficulty"
            options={fc.difficulties}
            selected={f.difficulties}
            onToggle={(value) => stage({ difficulties: toggleValue(f.difficulties, value) })}
          />
        ),
      });
    }
    if (!hide.includes("villages") && fc.villages.length > 0) {
      sections.push({
        id: "villages",
        label: "Village",
        selected: f.villages.length,
        content: (
          <FacetList
            bare
            label="Village"
            options={fc.villages}
            selected={f.villages}
            onToggle={(value) => stage({ villages: toggleValue(f.villages, value) })}
          />
        ),
      });
    }
    if (!hide.includes("tracks") && fc.tracks.length > 0) {
      sections.push({
        id: "tracks",
        label: "Track",
        selected: f.tracks.length,
        content: (
          <FacetList
            bare
            label="Track"
            options={fc.tracks}
            selected={f.tracks}
            onToggle={(value) => stage({ tracks: toggleValue(f.tracks, value) })}
          />
        ),
      });
    }
    sections.push({
      id: "topics",
      label: "Topics",
      selected: f.topics.length,
      content: (
        <TopicFacet
          bare
          options={fc.topics}
          selected={f.topics}
          onToggle={(value) => stage({ topics: toggleValue(f.topics, value) })}
          labelFor={labelFor}
        />
      ),
    });
    if (!hide.includes("speakers")) {
      sections.push({
        id: "speakers",
        label: "Speakers",
        selected: f.speakers.length,
        content: (
          <SpeakerFacet
            bare
            options={fc.speakers}
            selected={f.speakers}
            onToggle={(value) => stage({ speakers: toggleValue(f.speakers, value) })}
          />
        ),
      });
    }
    return sections;
  };

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
          onKeyDown={(event) => {
            if (!linkArchiveSearch || event.key !== "Enter") return;
            event.preventDefault();
            router.push(
              archiveSearchHref({
                q: draftQuery,
                years: filters.years,
                conferences: filters.conferences,
                tracks: filters.tracks,
                topics: filters.topics,
                difficulties: filters.difficulties,
                sort: filters.sort,
              }),
            );
          }}
          placeholder={searchPlaceholder}
          enterKeyHint={linkArchiveSearch ? "search" : undefined}
          className={`w-full bg-transparent font-mono text-mint outline-none placeholder:text-mint/30 [&::-webkit-search-cancel-button]:hidden ${
            large ? "text-base sm:text-lg" : "text-sm"
          }`}
        />
        {draftQuery ? (
          <button
            type="button"
            onClick={() => setDraftQuery("")}
            className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-mag hover:text-acid"
          >
            Clear
          </button>
        ) : null}
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
      {linkArchiveSearch &&
      (draftQuery.trim() ||
        filters.years.length > 0 ||
        filters.conferences.length > 0 ||
        filters.tracks.length > 0 ||
        filters.topics.length > 0 ||
        filters.difficulties.length > 0) ? (
        <p className="mt-2.5 px-1 text-[11px] uppercase tracking-[0.18em]">
          <Link
            href={archiveSearchHref({
              q: draftQuery,
              years: filters.years,
              conferences: filters.conferences,
              tracks: filters.tracks,
              topics: filters.topics,
              difficulties: filters.difficulties,
              sort: filters.sort,
            })}
            className="link"
          >
            see all results
          </Link>
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      {hero ? (
        <section className="hero panel relative overflow-hidden px-4 py-5 sm:px-7 sm:py-7">
          {masthead}
          <div className="relative mt-5 max-w-3xl">{search}</div>
        </section>
      ) : (
        <>
          {masthead ? <div key="masthead">{masthead}</div> : null}

          {/* Search comes first; the facet rail refines from there. */}
          <div key="search">{search}</div>
        </>
      )}

      <div className="fold-layout grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        {/* Desktop rail grows with the page; only compact facets scroll internally. */}
        <aside className="fold-rail hidden lg:block">
          <div className="space-y-5">
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
          <details
            open
            className={`fold-drawer panel group lg:hidden ${push ? "max-[599px]:hidden" : ""}`}
          >
            <summary className="cursor-pointer list-none px-4 py-3 font-display text-xs uppercase tracking-[0.2em] text-acid">
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
              <span className="float-right text-mint/50 group-open:hidden">+</span>
              <span className="float-right hidden text-mint/50 group-open:inline">−</span>
            </summary>
            <div className="border-t border-acid/15 p-4">{renderPanel()}</div>
          </details>

          {/* Phone (<600px): opens the push panel. Hidden at every other width. */}
          {push ? (
            <button
              ref={pushBarRef}
              type="button"
              data-testid="push-filters-open"
              onClick={() => openPush(pushBarRef.current)}
              aria-haspopup="dialog"
              aria-expanded={pushOpen}
              className="panel hidden min-h-11 w-full items-center gap-3 px-4 text-left max-[599px]:!mt-0 max-[599px]:flex"
            >
              <span aria-hidden className="text-acid">
                ☰
              </span>
              <span className="flex-1 font-display text-xs uppercase tracking-[0.2em] text-acid">
                Filters
              </span>
              {activeCount > 0 ? (
                <span className="rounded-sm border border-acid/50 bg-acid/15 px-1.5 py-0.5 text-[10px] tabular-nums text-acid">
                  {activeCount} on
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-[0.16em] text-mint/40">none</span>
              )}
              <span aria-hidden className="text-mint/50">
                ›
              </span>
            </button>
          ) : null}

          <div
            ref={resultsRef}
            className="flex flex-wrap items-center justify-between gap-3 scroll-mt-24"
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-mint/60">
              {shownTotal === 0
                ? "0 talks"
                : `${shownFrom}–${shownTo} of ${shownTotal} talk${shownTotal === 1 ? "" : "s"}`}
              {shownTotal !== universe ? (
                <span className="text-mint/30"> / {universe}</span>
              ) : null}
              {catalogLoading || listingPending ? (
                <span className="text-mint/30"> · loading…</span>
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
                  className="fold-clear text-[11px] uppercase tracking-[0.14em] text-mag hover:text-acid lg:hidden"
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
                  {sortOptions.map((option) => (
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
            <div className="fold-cards grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paged.items.map((talk) => (
                <TalkCard key={talk.id} talk={talk} />
              ))}
            </div>
          )}

          <Pagination page={paged.page} totalPages={paged.totalPages} onChange={goToPage} />
          </div>
      </div>

      {footer && activeCount === 0 ? (
        <div className="space-y-10 border-t border-acid/15 pt-8">{footer}</div>
      ) : null}

      {push ? (
        <PushFilters
          open={pushOpen}
          pageRef={push.pageRef}
          onPrepare={preparePush}
          onOpen={openPush}
          onClose={closePush}
          onClosed={onPushClosed}
          onApply={applyPush}
          onReset={resetPush}
          count={stagedCount}
          activeCount={activeCount}
          stagedActive={staged ? countActive({ ...staged, q: "" }) : 0}
          loading={catalogLoading}
          sections={pushSections()}
          extras={
            hasExtras && staged ? (
              <label className="flex min-h-10 cursor-pointer select-none items-center gap-2 text-[13px] text-mint/80">
                <input
                  type="checkbox"
                  checked={staged.includeExtras}
                  onChange={(e) => stage({ includeExtras: e.target.checked })}
                  className="rounded-sm border border-acid/40 bg-void accent-cyan"
                />
                <span>Include clips &amp; extras</span>
              </label>
            ) : undefined
          }
          openerRef={pushOpenerRef}
        />
      ) : null}
    </div>
  );
}
