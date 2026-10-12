"use client";

import { useEffect, useState } from "react";
import { getSavedState, toggleSaved, type SavedState } from "@/lib/saved";

type Props = {
  talkId: string;
  /** "icon" = just the star, "full" = star + label */
  variant?: "icon" | "full";
};

export function BookmarkButton({ talkId, variant = "icon" }: Props) {
  const [state, setState] = useState<SavedState | null>(null);

  // Hydrate after mount to avoid SSR mismatch
  useEffect(() => {
    setState(getSavedState());
    const handler = () => setState(getSavedState());
    window.addEventListener("saved-changed", handler);
    return () => window.removeEventListener("saved-changed", handler);
  }, []);

  if (state === null) {
    // Not yet hydrated — render placeholder of same size
    return (
      <button
        type="button"
        aria-label="Bookmark"
        disabled
        className={`inline-flex items-center gap-1.5 transition ${
          variant === "full" ? "chip opacity-40" : "opacity-40"
        }`}
      >
        <BookmarkIcon saved={false} />
        {variant === "full" ? <span>Save</span> : null}
      </button>
    );
  }

  const saved = state.saved.includes(talkId);

  return (
    <button
      type="button"
      aria-label={saved ? "Remove bookmark" : "Bookmark this talk"}
      onClick={() => setState(toggleSaved(talkId))}
      className={`inline-flex items-center gap-1.5 transition ${
        variant === "full"
          ? `chip ${saved ? "!border-acid !text-acid" : ""}`
          : `rounded p-1 hover:text-acid ${saved ? "text-acid" : "text-mint/40 hover:text-acid/70"}`
      }`}
    >
      <BookmarkIcon saved={saved} />
      {variant === "full" ? <span>{saved ? "Saved" : "Save"}</span> : null}
    </button>
  );
}

function BookmarkIcon({ saved }: { saved: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill={saved ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M2 2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v10.5l-5-3-5 3V2z" />
    </svg>
  );
}
