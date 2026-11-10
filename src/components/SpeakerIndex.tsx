"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Speaker } from "@/lib/types";
import { Pagination } from "@/components/browser/Pagination";

const PAGE_SIZE = 100;
const REPEAT_CAP = 48;
const MIN_QUERY = 2;

export type SpeakerRow = Pick<Speaker, "name" | "slug" | "talkCount">;

/**
 * Search-first speaker directory. The page only ships the frequent presenters
 * and the person count; the full name list loads the first time the search
 * field is used.
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
  const [failed, setFailed] = useState(false);
  const requested = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = needle.trim().toLowerCase();
  const searching = query.length >= MIN_QUERY;

  const loadPeople = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    fetch("/api/speakers")
      .then((response) => {
        if (!response.ok) throw new Error(`Speakers returned ${response.status}`);
        return response.json() as Promise<{ speakers?: [string, string, number][] }>;
      })
      .then((body) =>
        setPeople((body.speakers ?? []).map(([name, slug, talkCount]) => ({ name, slug, talkCount }))),
      )
      .catch(() => {
        requested.current = false;
        setFailed(true);
      });
  }, []);

  // Wider screens focus the field on load. Phones do not: it would open the keyboard.
  useEffect(() => {
    if (window.matchMedia("(min-width: 600px)").matches) inputRef.current?.focus();
  }, []);

  const matching = useMemo(() => {
    if (!searching || !people) return [];
    return people.filter((speaker) => speaker.name.toLowerCase().includes(query));
  }, [people, query, searching]);

  const alphabetical = useMemo(
    () => matching.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [matching],
  );

  const totalPages = Math.max(1, Math.ceil(alphabetical.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return alphabetical.slice(start, start + PAGE_SIZE);
  }, [alphabetical, page]);

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
        onFocus={loadPeople}
        onChange={(event) => {
          loadPeople();
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

      {searching && !people ? (
        <p className="text-sm text-mint/50" role="status">
          {failed ? "Could not load speaker names. Try again." : "Loading speaker names…"}
        </p>
      ) : null}

      {searching && people ? (
        <section>
          <h2 className="mb-3 border-b border-acid/15 pb-2 font-display text-xs uppercase tracking-[0.2em] text-cyan">
            {alphabetical.length.toLocaleString("en-US")} matching
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
  );
}
