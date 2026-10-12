"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type TopicEntry = { topic: string; label: string; count: number };

const TOP = 24;

/**
 * The only full list of topics in the site. Filtered, counted, and split into
 * "most used" ahead of the complete run.
 */
export function TopicIndex({ topics }: { topics: TopicEntry[] }) {
  const [needle, setNeedle] = useState("");
  const query = needle.trim().toLowerCase();

  const matching = useMemo(
    () => (query ? topics.filter((entry) => entry.topic.includes(query)) : topics),
    [topics, query],
  );

  const alphabetical = useMemo(
    () => matching.slice().sort((a, b) => a.topic.localeCompare(b.topic)),
    [matching],
  );

  return (
    <div className="space-y-8">
      <input
        type="search"
        value={needle}
        onChange={(event) => setNeedle(event.target.value)}
        placeholder="Filter topics…"
        aria-label="Filter topics"
        className="field max-w-md"
      />

      {!query ? (
        <section>
          <h2 className="mb-3 border-b border-acid/15 pb-2 font-display text-xs uppercase tracking-[0.2em] text-cyan">
            Most used
          </h2>
          <div className="flex flex-wrap gap-2">
            {topics.slice(0, TOP).map((entry) => (
              <Link key={entry.topic} href={`/topics/${entry.topic}`} className="chip !normal-case !tracking-normal">
                {entry.label}
                <span className="text-[10px] text-mint/40">{entry.count}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 border-b border-acid/15 pb-2 font-display text-xs uppercase tracking-[0.2em] text-cyan">
          {query ? `${alphabetical.length} matching` : `All ${topics.length}`}
        </h2>
        {alphabetical.length === 0 ? (
          <p className="text-sm text-mint/50">No topic matches “{needle}”.</p>
        ) : (
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {alphabetical.map((entry) => (
              <li key={entry.topic}>
                <Link
                  href={`/topics/${entry.topic}`}
                  className="flex items-baseline justify-between gap-3 border-b border-acid/10 py-1.5 text-[13px] text-mint/80 transition hover:text-acid"
                >
                  <span className="truncate">{entry.label}</span>
                  <span className="shrink-0 tabular-nums text-[11px] text-mint/35">
                    {entry.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
