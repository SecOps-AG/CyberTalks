"use client";

import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/CommandPalette";
import type { TalkIndexEntry } from "@/lib/types";

/**
 * Fetches the talk index from /api/talk-index on demand (after hydration)
 * so the palette doesn't block initial render.
 */
export function CommandPaletteProvider() {
  const [talks, setTalks] = useState<TalkIndexEntry[] | null>(null);

  useEffect(() => {
    // Load on first key press that would open the palette
    function onKey(e: KeyboardEvent) {
      const wouldOpen =
        ((e.metaKey || e.ctrlKey) && e.key === "k") ||
        (e.key === "/" &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement));
      if (wouldOpen && talks === null) {
        fetch("/api/talk-index")
          .then((r) => r.json())
          .then((data) => setTalks(data))
          .catch(() => setTalks([]));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [talks]);

  if (!talks) return null;
  return <CommandPalette talks={talks} />;
}
