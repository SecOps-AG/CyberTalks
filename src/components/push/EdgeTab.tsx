"use client";

import type { RefObject } from "react";
import { useEffect, useState } from "react";
import type { PushGesture } from "@/components/push/usePushMotion";

const NUDGE_KEY = "ct-edge-tab-nudged";
/** Let the page settle before the tab wiggles, so the motion reads as a hint. */
const NUDGE_DELAY_MS = 1200;

/**
 * Phone-only (<600px) pull tab fixed to the left screen edge, the same edge
 * the push panel slides in from. Tap it, or drag it right, to open the panel.
 * On a phone's first visit it nudges once to show that it moves.
 *
 * Rendered by PushFilters inside its <body> portal, so the pushed page's
 * transform never re-anchors it. `display: none` at 600px and up (see
 * `.edge-tab` in globals.css).
 */
export function EdgeTab({
  tabRef,
  activeCount,
  hidden,
  onClick,
  gesture,
}: {
  tabRef: RefObject<HTMLButtonElement | null>;
  activeCount: number;
  /** True while the panel is open: the tab rides out with it and leaves the tab order. */
  hidden: boolean;
  onClick: () => void;
  gesture: PushGesture;
}) {
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    const visible = window.matchMedia(
      "(max-width: 599px) and (prefers-reduced-motion: no-preference)",
    );
    if (!visible.matches) return;
    try {
      if (localStorage.getItem(NUDGE_KEY)) return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => {
      setNudge(true);
      try {
        localStorage.setItem(NUDGE_KEY, "1");
      } catch {
        // Storage blocked: the nudge may repeat next visit, which is harmless.
      }
    }, NUDGE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <button
      ref={tabRef}
      type="button"
      data-testid="edge-tab"
      className="edge-tab"
      data-hidden={hidden}
      data-nudge={nudge || undefined}
      inert={hidden}
      onClick={onClick}
      onAnimationEnd={() => setNudge(false)}
      {...gesture}
      aria-haspopup="dialog"
      aria-expanded={hidden}
      aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"}
    >
      <span aria-hidden className="edge-tab-label">
        Filters
      </span>
      {activeCount > 0 ? (
        <span aria-hidden className="edge-tab-badge">
          {activeCount}
        </span>
      ) : null}
    </button>
  );
}
