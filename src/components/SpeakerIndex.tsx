"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Speaker } from "@/lib/types";
import { Pagination } from "@/components/browser/Pagination";
import { SPEAKER_SEARCH_MIN_QUERY, SPEAKER_SEARCH_PAGE_SIZE } from "@/lib/speaker-search";

const PAGE_SIZE = SPEAKER_SEARCH_PAGE_SIZE;
const REPEAT_CAP = 48;
const MIN_QUERY = SPEAKER_SEARCH_MIN_QUERY;

export type SpeakerRow = Pick<Speaker, "name" | "slug" | "talkCount">;

/**
 * Search-first speaker directory. The page ships the frequent presenters
 * and the person count. Each search asks the server for one page of matches.
 */
export function SpeakerIndex({
  repeats,
  personCount,
}: {
  repeats: SpeakerRow[];
  personCount: number;
}) {
  const [needle, setNeedle] = useState("");
  const [page, setPage] = useState(1);
  const [people, setPeople] = useState<SpeakerRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [holdHeight, setHoldHeight] = useState<number | undefined>();
  const query = needle.trim().toLowerCase();
  const searching = query.length >= MIN_QUERY;

  useEffect(() => {
    if (!searching) {
      setPeople(null);
      setTotal(0);
      setFailed(false);
      setLoading(false);
      setHoldHeight(undefined);
      return;
    }
    const height = resultsRef.current?.getBoundingClientRect().height ?? 0;
    if (height > 48) setHoldHeight(height);
    setPeople(null);
    setTotal(0);
    setFailed(false);
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, page: String(page) });
      fetch(`/api/speakers?${params}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`Speakers returned ${response.status}`);
          return response.json() as Promise<{
            total?: number;
            speakers?: [string, string, number][];
          }>;
        })
        .then((body) => {
          setPeople(
            (body.speakers ?? []).map(([name, slug, talkCount]) => ({ name, slug, talkCount })),
          );
          setTotal(body.total ?? 0);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setPeople(null);
          setFailed(true);
          setLoading(false);
        });
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, query, searching]);

  // Wider screens focus the field on load. Phones do not: it would open the keyboard.
  useEffect(() => {
    if (window.matchMedia("(min-width: 600px)").matches) inputRef.current?.focus();
  }, []);

  const alphabetical = people ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = alphabetical;

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-8">
      <input
        type="search"
        value={needle}
        ref={inputRef}
        onChange={(event) => {
          setNeedle(event.target.value);
        }}
        placeholder="Search speakers by name…"
        aria-label="Search speakers"
        className="field max-w-md max-[599px]:min-h-12"
      />

      {!searching ? (
        <p className="max-w-2xl text-sm text-mint/50">
          Type at least {MIN_QUERY} characters to search{" "}
          {personCount.toLocaleString("en-US")} person names. Company names,
          conference titles, and other non-speaker credits are hidden here until the catalog
          cleanup lands.
        </p>
      ) : null}

      {!searching && repeats.length > 0 ? (
        <section>
          <h2 className="mb-3 border-b border-acid/15 pb-2 font-display text-xs uppercase tracking-[0.2em] text-cyan">
            Frequent presenters
          </h2>
          <div className="flex flex-wrap gap-2">
            {repeats.map((speaker) => (
              <Link
                key={speaker.slug}
                href={`/speakers/${speaker.slug}`}
                className="chip !normal-case !tracking-normal"
              >
                {speaker.name}
                <span className="text-[10px] text-mint/40">{speaker.talkCount}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!searching && repeats.length === 0 ? (
        <p className="text-sm text-mint/50">Search for a speaker name to browse the archive.</p>
      ) : null}

      {searching ? (
        <div ref={resultsRef} style={holdHeight ? { minHeight: holdHeight } : undefined}>
      {searching && (loading || !people) ? (
        <p className="text-sm text-mint/50" role="status">
          {failed ? "Could not load speaker names. Try again." : "Loading speaker names…"}
        </p>
      ) : null}

      {searching && people && !loading ? (
        <section>
          <h2 className="mb-3 border-b border-acid/15 pb-2 font-display text-xs uppercase tracking-[0.2em] text-cyan">
            {total.toLocaleString("en-US")} matching
            {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
          </h2>
          {alphabetical.length === 0 ? (
            <p className="text-sm text-mint/50">No person name matches “{needle.trim()}”.</p>
          ) : (
            <>
              <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {pageItems.map((speaker) => (
                  <li key={speaker.slug}>
                    <Link
                      href={`/speakers/${speaker.slug}`}
                      className="flex items-baseline justify-between gap-3 border-b border-acid/10 py-1.5 text-[13px] max-[599px]:py-3 text-mint/80 transition hover:text-acid"
                    >
                      <span className="truncate">{speaker.name}</span>
                      <span className="shrink-0 tabular-nums text-[11px] text-mint/35">
                        {speaker.talkCount}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </div>
            </>
          )}
        </section>
      ) : null}
        </div>
      ) : null}
    </div>
  );
}
