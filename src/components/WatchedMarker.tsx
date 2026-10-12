"use client";

import { useEffect } from "react";
import { markWatched } from "@/lib/saved";

/**
 * Marks a talk as watched when the YouTube iframe receives focus (user clicked
 * play) or when the "Open on YouTube" link is clicked.
 */
export function WatchedMarker({
  talkId,
  youtubeUrl,
}: {
  talkId: string;
  youtubeUrl: string;
}) {
  useEffect(() => {
    function onBlur() {
      // When the window loses focus and an iframe just became active, the user
      // likely clicked the video player.
      if (document.activeElement?.tagName === "IFRAME") {
        markWatched(talkId);
      }
    }
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [talkId]);

  function handleYouTubeClick() {
    markWatched(talkId);
  }

  return (
    <a
      href={youtubeUrl}
      target="_blank"
      rel="noreferrer"
      className="chip"
      onClick={handleYouTubeClick}
    >
      Open on YouTube ↗
    </a>
  );
}
