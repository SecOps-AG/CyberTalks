"use client";

import { useEffect, useRef, useState } from "react";
import { CommandPalette } from "@/components/CommandPalette";
import { fetchTalkIndexShards } from "@/lib/fetch-talk-index";
import type { TalkIndexEntry } from "@/lib/types";

/**
 * Loads the talk index from manifest-driven chunks on demand (after hydration /
 * first palette keypress) so the palette doesn't block initial render or hit the
 * old /api/talk-index body-size limit.
 */
export function CommandPaletteProvider() {
  const [talks, setTalks] = useState<TalkIndexEntry[] | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const wouldOpen =
        ((e.metaKey || e.ctrlKey) && e.key === "k") ||
        (e.key === "/" &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement));
      if (wouldOpen && talks === null && !loadingRef.current) {
        loadingRef.current = true;
        fetchTalkIndexShards({
          onChunk: (data) => setTalks(data),
        })
          .then((data) => setTalks(data))
          .catch(() => setTalks([]));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [talks]);

  if (talks === null) return null;
  return <CommandPalette talks={talks} />;
}
