"use client";

import { useState } from "react";
import { thumbnailSrc } from "@/lib/materials";
import { markWatched } from "@/lib/saved";

/**
 * YouTube player that loads on tap. The page first shows the poster image and
 * a play button; the stock iframe (no nocookie player) is only requested once
 * someone asks for the video.
 */
export function YouTubeEmbed({
  videoId,
  title,
  talkId,
}: {
  videoId: string;
  title: string;
  /** Marks the talk watched when play is pressed. */
  talkId?: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="panel overflow-hidden">
      <div className="relative aspect-video bg-black">
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (talkId) markWatched(talkId);
              setPlaying(true);
            }}
            aria-label={`Play video: ${title}`}
            className="group absolute inset-0 grid h-full w-full place-items-center"
          >
            <img
              src={thumbnailSrc(videoId)}
              alt=""
              width={480}
              height={270}
              fetchPriority="high"
              decoding="async"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover opacity-85 transition group-hover:opacity-100"
            />
            <span className="relative grid h-12 w-[4.25rem] place-items-center rounded-[10px] bg-acid text-void shadow-glow transition group-hover:bg-cyan">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
