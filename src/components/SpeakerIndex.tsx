"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Speaker } from "@/lib/types";

/**
 * The only full list of speakers in the site. It leads with a filter box and
 * pulls repeat presenters out ahead of the alphabetical run. Mirrors
 * TopicIndex: same long-tail problem.
 */
export function SpeakerIndex({ speakers }: { speakers: Speaker[] }) {
  const [needle, setNeedle] = useState("");
  const query = needle.trim().toLowerCase();

  const matching = useMemo(
    () =>
      query
        ? speakers.filter((speaker) => speaker.name.toLowerCase().includes(query))
        : speakers,
    [speakers, query],
  );

  const alphabetical = useMemo(
    () => matching.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [matching],
  );

  // `speakers` arrives count-first, so repeats are already at the head.
  const repeats = useMemo(
    () => speakers.filter((speaker) => speaker.talkCount > 1),
    [speakers],
  );

  return (
    <div className="space-y-8">
      <input
        type="search"
        value={needle}
        onChange={(event) => setNeedle(event.target.value)}
        placeholder="Filter speakers…"
        aria-label="Filter speakers"
        className="field max-w-md"
      />

      {!query && repeats.length > 0 ? (
        <section>
          <h2 className="mb-3 border-b border-acid/15 pb-2 font-display text-xs uppercase tracking-[0.2em] text-cyan">
            More than one talk
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

      <section>
        <h2 className="mb-3 border-b border-acid/15 pb-2 font-display text-xs uppercase tracking-[0.2em] text-cyan">
          {query ? `${alphabetical.length} matching` : `All ${speakers.length}`}
        </h2>
        {alphabetical.length === 0 ? (
          <p className="text-sm text-mint/50">No speaker matches “{needle}”.</p>
        ) : (
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {alphabetical.map((speaker) => (
              <li key={speaker.slug}>
                <Link
                  href={`/speakers/${speaker.slug}`}
                  className="flex items-baseline justify-between gap-3 border-b border-acid/10 py-1.5 text-[13px] text-mint/80 transition hover:text-acid"
                >
                  <span className="truncate">{speaker.name}</span>
                  <span className="shrink-0 tabular-nums text-[11px] text-mint/35">
                    {speaker.talkCount}
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
