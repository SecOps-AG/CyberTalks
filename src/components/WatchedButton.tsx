"use client";

import { useEffect, useState } from "react";
import { getSavedState, markWatched, unmarkWatched } from "@/lib/saved";

/** Older saved lists may hold the same video under another id ending in its YouTube id. */
function matches(id: string, talkId: string, youtubeId?: string): boolean {
  return id === talkId || Boolean(youtubeId && id.endsWith(`-${youtubeId}`));
}

export function WatchedButton({ talkId, youtubeId }: { talkId: string; youtubeId?: string }) {
  const [watched, setWatched] = useState<boolean | null>(null);

  useEffect(() => {
    const load = () => setWatched(getSavedState().watched.some((id) => matches(id, talkId, youtubeId)));
    load();
    window.addEventListener("saved-changed", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("saved-changed", load);
      window.removeEventListener("storage", load);
    };
  }, [talkId, youtubeId]);

  function toggle() {
    if (watched) {
      for (const id of getSavedState().watched) if (matches(id, talkId, youtubeId)) unmarkWatched(id);
    } else {
      markWatched(talkId);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={watched === null}
      aria-pressed={Boolean(watched)}
      className={`chip inline-flex items-center gap-1.5 ${watched ? "!border-acid !text-acid" : ""} ${
        watched === null ? "opacity-40" : ""
      }`}
    >
      <span aria-hidden>{watched ? "✓" : "○"}</span>
      <span>{watched ? "Watched" : "Mark as watched"}</span>
    </button>
  );
}
