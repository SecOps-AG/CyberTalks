"use client";

import { useId, useMemo, useState } from "react";
import { splitHeroConferences } from "@/lib/labels";

export type HeroConference = {
  slug: string;
  label: string;
};

/**
 * Homepage hero blurb: talk/speaker counts and S-tier conference names.
 * Remaining conferences stay behind More so a long archive cannot dump
 * every label into the masthead paragraph.
 */
export function HeroConferences({
  talks,
  speakers,
  conferences,
}: {
  talks: number;
  speakers: number;
  conferences: HeroConference[];
}) {
  const [expanded, setExpanded] = useState(false);
  const restId = useId();
  const { featured, rest } = useMemo(
    () => splitHeroConferences(conferences),
    [conferences],
  );

  const moreCount = rest.length.toLocaleString("en-US");
  const moreText = rest.length === 1 ? "and 1 more" : `and ${moreCount} more`;

  return (
    <div className="mt-7 max-w-2xl text-sm leading-relaxed text-mint/70">
      <p>
        {talks.toLocaleString("en-US")} talks
        {featured.length > 0 ? ` from ${featured.join(", ")}` : null}
        {rest.length > 0 && !expanded ? (
          <>
            {featured.length > 0 ? ", " : " from "}
            <button
              type="button"
              className="text-cyan hover:text-acid"
              aria-expanded={false}
              aria-controls={restId}
              onClick={() => setExpanded(true)}
            >
              {featured.length > 0 ? moreText : `${moreCount} more`}
            </button>
          </>
        ) : null}
        {" · "}
        {speakers.toLocaleString("en-US")} speakers.
      </p>
      {expanded && rest.length > 0 ? (
        <p id={restId} className="mt-2 text-mint/55">
          {rest.map((conference) => conference.label).join(", ")}{" "}
          <button
            type="button"
            className="text-cyan hover:text-acid"
            aria-expanded={true}
            onClick={() => setExpanded(false)}
          >
            Show fewer
          </button>
        </p>
      ) : null}
    </div>
  );
}
