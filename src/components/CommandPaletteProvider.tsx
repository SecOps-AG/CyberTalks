"use client";

import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/CommandPalette";
import { fetchTalkIndexShards } from "@/lib/fetch-talk-index";
import type { TalkIndexEntry } from "@/lib/types";

/**
 * Loads the talk index from year shards on demand (after hydration / first
 * palette keypress) so the palette doesn't block initial render or hit the
 * old /api/talk-index body-size limit.
 */
export function CommandPaletteProvider() {
  const [talks, setTalks] = useState<TalkIndexEntry[] | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const wouldOpen =
        ((e.metaKey || e.ctrlKey) && e.key === "k") ||
        (e.key === "/" &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement));
      if (wouldOpen && talks === null) {
        fetchTalkIndexShards()
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
