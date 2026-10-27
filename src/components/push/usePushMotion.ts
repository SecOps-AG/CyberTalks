"use client";

import type { PointerEvent, RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";

/** Movement before a touch is read as a horizontal drag or a vertical scroll. */
const AXIS_SLOP_PX = 8;
/** iOS starts its back-swipe at the screen edge, so drags may not start there. */
const EDGE_GUARD_PX = 16;
/** A flick this fast (px/ms) snaps its way regardless of distance travelled. */
const FLICK_PX_PER_MS = 0.45;
/** Slower drags must cover this share of the panel width to switch state. */
const SNAP_SHARE = 0.4;
/** Only the last stretch of movement counts toward release velocity. */
const VELOCITY_WINDOW_MS = 80;

type Drag = {
  pointerId: number;
  /** A drag that starts closed can only open, one that starts open can only close. */
  fromOpen: boolean;
  startX: number;
  startY: number;
  /** Set once the gesture reads as horizontal; until then it may still be a scroll. */
  tracking: boolean;
  width: number;
  scale: number;
  fadeOnly: boolean;
  /** 0 = closed, 1 = open. */
  progress: number;
  samples: { x: number; t: number }[];
  frame: number;
};

type PointerHandler = (event: PointerEvent<HTMLElement>) => void;

export type PushGesture = {
  onPointerDown: PointerHandler;
  onPointerMove: PointerHandler;
  onPointerUp: PointerHandler;
  onPointerCancel: PointerHandler;
};

const root = () => document.documentElement;

/** Duration and scale live in CSS (`.push-page` in globals.css); read them from there. */
function readMotion(page: HTMLElement) {
  const style = getComputedStyle(page);
  const duration = style.getPropertyValue("--push-duration").trim();
  const value = parseFloat(duration);
  return {
    ms: Number.isFinite(value) ? (duration.endsWith("ms") ? value : value * 1000) : 0,
    scale: parseFloat(style.getPropertyValue("--push-scale")) || 1,
  };
}

/**
 * Freezes page scroll and records the visible window, which the page's
 * transform origin and rounded clip are centred on while it is pushed aside.
 */
function lock(page: HTMLElement) {
  if (root().hasAttribute("data-push-lock")) return;
  page.style.setProperty("--push-y", `${window.scrollY}px`);
  page.style.setProperty("--push-h", `${window.innerHeight}px`);
  root().setAttribute("data-push-lock", "");
}

function unlock(page: HTMLElement | null) {
  root().removeAttribute("data-push-lock");
  page?.style.removeProperty("--push-y");
  page?.style.removeProperty("--push-h");
}

function clearInline(...elements: (HTMLElement | null)[]) {
  for (const element of elements) {
    element?.style.removeProperty("transform");
    element?.style.removeProperty("opacity");
  }
}

/**
 * Slide and drag for the phone push panel. Open/close transitions are plain
 * CSS keyed on `data-open`; a drag writes transforms straight onto the page,
 * panel, scrim and edge tab once per frame, then hands back to CSS on release
 * so the snap continues from wherever the finger let go.
 */
export function usePushMotion({
  open,
  pageRef,
  onPrepare,
  onOpen,
  onClose,
  onSettled,
}: {
  open: boolean;
  pageRef: RefObject<HTMLElement | null>;
  /** A drag from the closed state has started: render the panel's contents. */
  onPrepare: () => void;
  onOpen: () => void;
  onClose: () => void;
  /** The close slide has finished and the page scrolls again. */
  onSettled: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLButtonElement>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);
  const settleTimer = useRef(0);
  const swallowClick = useRef(false);
  const wasOpen = useRef(false);
  const callbacks = useRef({ onPrepare, onOpen, onClose, onSettled });
  callbacks.current = { onPrepare, onOpen, onClose, onSettled };

  // will-change only for the length of one slide; a finished close hands
  // scroll back to the page.
  const animate = useCallback(
    (toOpen: boolean) => {
      const page = pageRef.current;
      if (!page) return;
      window.clearTimeout(settleTimer.current);
      root().setAttribute("data-push-moving", "");
      settleTimer.current = window.setTimeout(() => {
        root().removeAttribute("data-push-moving");
        if (toOpen) return;
        unlock(page);
        callbacks.current.onSettled();
      }, readMotion(page).ms + 40);
    },
    [pageRef],
  );

  // Layout effect: the lock sets the transform origin, which has to land in
  // the same frame as `data-open` or the first frame scales from the wrong spot.
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    if (open) {
      wasOpen.current = true;
      lock(page);
      animate(true);
    } else if (wasOpen.current) {
      wasOpen.current = false;
      animate(false);
    }
  }, [open, pageRef, animate]);

  useEffect(() => {
    const page = pageRef.current;
    return () => {
      window.clearTimeout(settleTimer.current);
      if (drag.current) cancelAnimationFrame(drag.current.frame);
      root().removeAttribute("data-push-drag");
      root().removeAttribute("data-push-moving");
      unlock(page);
    };
  }, [pageRef]);

  const paint = () => {
    const d = drag.current;
    const page = pageRef.current;
    const panel = panelRef.current;
    if (!d || !page || !panel) return;
    d.frame = 0;
    const p = d.progress;
    const scrim = scrimRef.current;
    const tab = tabRef.current;
    scrim?.style.setProperty("opacity", `${p}`);
    tab?.style.setProperty("opacity", `${1 - p}`);
    if (d.fadeOnly) {
      panel.style.setProperty("opacity", `${p}`);
      return;
    }
    const x = p * d.width;
    const card = `translate3d(${x}px, 0, 0) scale(${1 - p * (1 - d.scale)})`;
    page.style.setProperty("transform", card);
    scrim?.style.setProperty("transform", card);
    panel.style.setProperty("transform", `translate3d(${x - d.width}px, 0, 0)`);
    tab?.style.setProperty("transform", `translate3d(${x}px, -50%, 0)`);
  };

  const begin = (event: PointerEvent<HTMLElement>, fromOpen: boolean) => {
    swallowClick.current = false;
    if (fromOpen !== open || drag.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!fromOpen && event.clientX < EDGE_GUARD_PX) return;
    if (event.target instanceof Element && event.target.closest("input, select, textarea")) return;
    drag.current = {
      pointerId: event.pointerId,
      fromOpen,
      startX: event.clientX,
      startY: event.clientY,
      tracking: false,
      width: 0,
      scale: 1,
      fadeOnly: false,
      progress: fromOpen ? 1 : 0,
      samples: [],
      frame: 0,
    };
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    if (!d.tracking) {
      const dx = event.clientX - d.startX;
      const dy = event.clientY - d.startY;
      if (Math.hypot(dx, dy) < AXIS_SLOP_PX) return;
      const page = pageRef.current;
      const panel = panelRef.current;
      const towardTarget = d.fromOpen ? dx < 0 : dx > 0;
      if (!page || !panel || !towardTarget || Math.abs(dx) <= Math.abs(dy)) {
        drag.current = null;
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      window.clearTimeout(settleTimer.current);
      lock(page);
      root().setAttribute("data-push-drag", "");
      root().setAttribute("data-push-moving", "");
      d.tracking = true;
      d.width = panel.offsetWidth;
      d.scale = readMotion(page).scale;
      d.fadeOnly = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Measure from here so the panel does not jump by the slop distance.
      d.startX = event.clientX;
      if (!d.fromOpen) callbacks.current.onPrepare();
    }
    const delta = (event.clientX - d.startX) / d.width;
    d.progress = Math.min(1, Math.max(0, (d.fromOpen ? 1 : 0) + delta));
    d.samples.push({ x: event.clientX, t: event.timeStamp });
    while (event.timeStamp - d.samples[0].t > VELOCITY_WINDOW_MS) d.samples.shift();
    if (!d.frame) d.frame = requestAnimationFrame(paint);
  };

  const end = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    drag.current = null;
    if (!d.tracking) return;
    cancelAnimationFrame(d.frame);
    swallowClick.current = true;

    // Divide by time to release, so a finger that stopped before lifting reads as slow.
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const velocity =
      first && last && event.type === "pointerup"
        ? (last.x - first.x) / Math.max(1, event.timeStamp - first.t)
        : 0;
    const toOpen =
      Math.abs(velocity) >= FLICK_PX_PER_MS
        ? velocity > 0
        : d.progress >= (d.fromOpen ? 1 - SNAP_SHARE : SNAP_SHARE);

    // Drop the inline frame and the drag flag together: CSS transitions then
    // run from the last painted position to the `data-open` target.
    clearInline(pageRef.current, panelRef.current, scrimRef.current, tabRef.current);
    root().removeAttribute("data-push-drag");
    if (toOpen !== d.fromOpen) {
      flushSync(() => (toOpen ? callbacks.current.onOpen() : callbacks.current.onClose()));
    } else {
      animate(toOpen);
    }
  };

  const gesture = (fromOpen: boolean): PushGesture => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => begin(event, fromOpen),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  });

  return {
    panelRef,
    scrimRef,
    tabRef,
    /** Handlers for the edge tab: drag right to open. */
    openGesture: gesture(false),
    /** Handlers for the panel and scrim: drag left to close. */
    closeGesture: gesture(true),
    /** True once for the click a finished drag leaves behind. */
    consumeDragClick: () => {
      const swallowed = swallowClick.current;
      swallowClick.current = false;
      return swallowed;
    },
  };
}
