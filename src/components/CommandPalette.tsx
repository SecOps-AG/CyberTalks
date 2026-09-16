"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { filterTalks, withHaystack, slugifySpeaker, EMPTY_FILTERS } from "@/lib/search";
import type { TalkIndexEntry } from "@/lib/types";

type ResultItem = {
  type: "talk" | "village" | "speaker" | "track" | "topic";
  label: string;
  sub?: string;
  href: string;
};

function buildResults(query: string, talks: TalkIndexEntry[]): ResultItem[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);

  const searchable = withHaystack(talks);
  const matchedTalks = filterTalks(searchable, {
    ...EMPTY_FILTERS,
    q: query,
  }).slice(0, 6);

  const results: ResultItem[] = matchedTalks.map((t) => ({
    type: "talk",
    label: t.title,
    sub: `${t.villageName} · ${t.eventShortName}`,
    href: `/talks/${t.slug}`,
  }));

  // Villages
  const villageMap = new Map<string, string>();
  for (const talk of talks) {
    if (!villageMap.has(talk.villageSlug)) villageMap.set(talk.villageSlug, talk.villageName);
  }
  for (const [slug, name] of [...villageMap.entries()].filter(([, n]) => n.toLowerCase().includes(q)).slice(0, 3)) {
    results.push({ type: "village", label: name, sub: "Village", href: `/villages/${slug}` });
  }

  // Tracks
  const trackMap = new Map<string, string>();
  for (const talk of talks) {
    if (!trackMap.has(talk.track)) trackMap.set(talk.track, talk.trackName);
  }
  for (const [slug, name] of [...trackMap.entries()].filter(([, n]) => n.toLowerCase().includes(q)).slice(0, 3)) {
    results.push({ type: "track", label: name, sub: "Track", href: `/tracks/${slug}` });
  }

  // Topics
  const topicSet = new Set<string>();
  for (const talk of talks) for (const t of talk.topics) topicSet.add(t);
  for (const topic of [...topicSet].filter((t) => terms.every((term) => t.toLowerCase().includes(term))).slice(0, 3)) {
    results.push({ type: "topic", label: topic, sub: "Topic", href: `/topics/${topic}` });
  }

  // Speakers
  const speakerMap = new Map<string, string>();
  for (const talk of talks) {
    for (const speaker of talk.speakers) {
      const slug = slugifySpeaker(speaker);
      if (slug && !speakerMap.has(slug)) speakerMap.set(slug, speaker);
    }
  }
  for (const [slug, name] of [...speakerMap.entries()].filter(([, n]) => terms.every((term) => n.toLowerCase().includes(term))).slice(0, 3)) {
    results.push({ type: "speaker", label: name, sub: "Speaker", href: `/speakers/${slug}` });
  }

  return results;
}

const TYPE_BADGE: Record<ResultItem["type"], string> = {
  talk: "talk",
  village: "village",
  speaker: "speaker",
  track: "track",
  topic: "topic",
};

export function CommandPalette({ talks }: { talks: TalkIndexEntry[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => buildResults(query, talks), [query, talks]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !open &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        openPalette();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        open ? close() : openPalette();
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        close();
      } else if (e.key === "ArrowDown" || (e.key === "j" && e.target === inputRef.current)) {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      } else if (e.key === "ArrowUp" || (e.key === "k" && e.target === inputRef.current)) {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter" && results[cursor]) {
        e.preventDefault();
        router.push(results[cursor].href);
        close();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, openPalette, close, results, cursor, router]);

  useEffect(() => setCursor(0), [results]);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[cursor] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />
      <div className="relative w-full max-w-xl">
        <div className="panel overflow-hidden">
          <div className="flex items-center gap-3 border-b border-acid/20 px-4 py-3">
            <span aria-hidden className="text-acid/70 text-sm">{">"}</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Jump to talk, speaker, village, track, or topic…"
              className="flex-1 bg-transparent font-mono text-sm text-mint outline-none placeholder:text-mint/30"
              aria-label="Search"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden sm:inline-flex items-center rounded border border-mint/20 px-1.5 py-0.5 font-mono text-[10px] text-mint/40">
              ESC
            </kbd>
          </div>

          {results.length > 0 ? (
            <ul ref={listRef} role="listbox" className="max-h-80 overflow-y-auto scroll-list">
              {results.map((item, i) => (
                <li key={`${item.href}-${i}`} role="option" aria-selected={i === cursor}>
                  <button
                    type="button"
                    onClick={() => { router.push(item.href); close(); }}
                    onMouseEnter={() => setCursor(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                      i === cursor ? "bg-acid/10" : "hover:bg-acid/5"
                    }`}
                  >
                    <span className="w-12 shrink-0 text-right font-mono text-[9px] uppercase tracking-[0.16em] text-mint/35">
                      {TYPE_BADGE[item.type]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${i === cursor ? "text-acid" : "text-mint"}`}>
                        {item.label}
                      </span>
                      {item.sub ? (
                        <span className="block truncate text-[11px] text-mint/40">{item.sub}</span>
                      ) : null}
                    </span>
                    {i === cursor ? (
                      <span className="shrink-0 font-mono text-[10px] text-acid/50">↵</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim() ? (
            <p className="px-4 py-6 text-center font-mono text-xs text-mint/35">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <p className="px-4 py-4 text-center font-mono text-[11px] text-mint/30">
              Type to search talks, speakers, villages, tracks, topics
            </p>
          )}

          <div className="border-t border-acid/10 flex items-center gap-4 px-4 py-2">
            <span className="font-mono text-[10px] text-mint/25"><kbd className="mr-1">↑↓</kbd>navigate</span>
            <span className="font-mono text-[10px] text-mint/25"><kbd className="mr-1">↵</kbd>open</span>
            <span className="font-mono text-[10px] text-mint/25"><kbd className="mr-1">esc</kbd>close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
