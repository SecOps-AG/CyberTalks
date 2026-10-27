"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EdgeTab } from "@/components/push/EdgeTab";
import { usePushMotion } from "@/components/push/usePushMotion";

export type PushSection = {
  id: string;
  label: string;
  /** Staged selections in this section, shown as a badge on the closed header. */
  selected: number;
  content: ReactNode;
};

/**
 * Phone-only (<600px) off-canvas filter panel and its left-edge pull tab. The
 * page itself (PushPage) slides right while this slides in from the left, so
 * the two edges stay glued and it reads as one surface being pushed aside.
 *
 * Everything here works on a staged copy of the filters owned by TalkBrowser;
 * nothing behind the panel changes until Apply.
 */
export function PushFilters({
  open,
  pageRef,
  onPrepare,
  onOpen,
  onClose,
  onClosed,
  onApply,
  onReset,
  count,
  activeCount,
  stagedActive,
  loading,
  sections,
  extras,
  openerRef,
}: {
  open: boolean;
  pageRef: RefObject<HTMLElement | null>;
  /** A drag from the edge tab has started: stage the applied filters. */
  onPrepare: () => void;
  onOpen: (opener: HTMLElement | null) => void;
  onClose: () => void;
  /** The panel has finished sliding away and the page scrolls again. */
  onClosed: () => void;
  onApply: () => void;
  onReset: () => void;
  /** Talks matching the staged selection. */
  count: number;
  /** Applied filters, for the edge tab badge. */
  activeCount: number;
  stagedActive: number;
  loading: boolean;
  sections: PushSection[];
  extras?: ReactNode;
  openerRef: RefObject<HTMLElement | null>;
}) {
  const [mounted, setMounted] = useState(false);
  // Null until the reader folds or unfolds a section: the first section plus
  // any that already carry a selection start open.
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const wasOpen = useRef(false);

  const motion = usePushMotion({
    open,
    pageRef,
    onPrepare,
    onOpen: () => onOpen(motion.tabRef.current),
    onClose,
    onSettled: () => {
      setExpanded(null);
      onClosed();
    },
  });

  useEffect(() => setMounted(true), []);

  // Focus hand-off: into the panel on open, back to whichever control opened it on close.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const frame = requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    openerRef.current?.focus({ preventScroll: true });
  }, [open, openerRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // Rotating or resizing past the phone breakpoint leaves no panel to see.
    const wide = window.matchMedia("(min-width: 600px)");
    const onWide = () => {
      if (wide.matches) onClose();
    };
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open, onClose]);

  const openIds =
    expanded ??
    new Set(
      sections
        .filter((section, index) => index === 0 || section.selected > 0)
        .map((section) => section.id),
    );
  const toggle = (id: string) => {
    const next = new Set(openIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  if (!mounted) return null;

  // Sections drift in one after another as the panel arrives.
  const stagger = (index: number) => ({ "--i": Math.min(index, 8) }) as CSSProperties;

  return createPortal(
    <>
      <div
        ref={motion.panelRef}
        data-testid="push-filters-panel"
        className="push-panel flex-col border-r border-acid/25 bg-void"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
        {...motion.closeGesture}
        onClickCapture={(event) => {
          if (motion.consumeDragClick()) event.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-acid/20 px-4 py-3">
          <h2
            id={titleId}
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-sm uppercase tracking-[0.2em] text-acid outline-none"
          >
            Filters
            {stagedActive > 0 ? <span className="ml-2 text-mint/50">({stagedActive})</span> : null}
          </h2>
          <div className="flex items-center gap-4">
            {stagedActive > 0 ? (
              <button
                type="button"
                onClick={onReset}
                className="text-[11px] uppercase tracking-[0.14em] text-mag hover:text-acid"
              >
                Reset
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="grid h-8 w-8 place-items-center rounded-sm border border-acid/25 text-mint/70 hover:text-acid"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
        </div>

        <div className="scroll-list min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {extras ? (
            <div className="push-stagger border-b border-acid/15 px-4 py-3" style={stagger(0)}>
              {extras}
            </div>
          ) : null}
          {sections.map((section, index) => {
            const isOpen = openIds.has(section.id);
            const regionId = `${titleId}-${section.id}`;
            return (
              <section
                key={section.id}
                className="push-stagger border-b border-acid/15"
                style={stagger(index + (extras ? 1 : 0))}
              >
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={regionId}
                    onClick={() => toggle(section.id)}
                    className="flex min-h-12 w-full items-center gap-3 px-4 text-left"
                  >
                    <span className="flex-1 font-display text-[11px] uppercase tracking-[0.2em] text-mint">
                      {section.label}
                    </span>
                    {section.selected > 0 ? (
                      <span className="rounded-sm border border-acid/50 bg-acid/15 px-1.5 py-0.5 text-[10px] tabular-nums text-acid">
                        {section.selected}
                      </span>
                    ) : null}
                    <span aria-hidden className="push-chevron text-mint/50" data-open={isOpen}>
                      ▾
                    </span>
                  </button>
                </h3>
                <div id={regionId} hidden={!isOpen} className="px-4 pb-4">
                  {section.content}
                </div>
              </section>
            );
          })}
        </div>

        <div className="border-t border-acid/25 bg-panel px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            data-testid="push-filters-apply"
            onClick={onApply}
            disabled={count === 0}
            className="flex min-h-12 w-full items-center justify-center rounded-sm border border-acid bg-acid font-display text-xs font-bold uppercase tracking-[0.18em] text-void shadow-glow transition disabled:border-mint/20 disabled:bg-transparent disabled:text-mint/40 disabled:shadow-none"
          >
            Show {count.toLocaleString("en-US")} talk{count === 1 ? "" : "s"}
          </button>
          <p className="mt-2 text-center text-[10px] uppercase tracking-[0.16em] text-mint/40">
            {loading
              ? "Catalog still loading · count may grow"
              : "Tap outside or swipe left to cancel"}
          </p>
        </div>
      </div>
      <button
        ref={motion.scrimRef}
        type="button"
        className="push-scrim"
        data-open={open}
        tabIndex={-1}
        aria-label="Close filters without applying"
        onClick={() => {
          if (!motion.consumeDragClick()) onClose();
        }}
        {...motion.closeGesture}
      />
      <EdgeTab
        tabRef={motion.tabRef}
        activeCount={activeCount}
        hidden={open}
        onClick={() => {
          if (!motion.consumeDragClick()) onOpen(motion.tabRef.current);
        }}
        gesture={motion.openGesture}
      />
    </>,
    document.body,
  );
}
