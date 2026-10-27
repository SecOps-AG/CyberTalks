"use client";

import type { ReactNode, RefObject } from "react";
import { createContext, useContext, useMemo, useRef, useState } from "react";

type PushState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  pageRef: RefObject<HTMLDivElement | null>;
};

const PushContext = createContext<PushState | null>(null);

/** Null outside the layout (tests, embeds): callers treat that as "no push menu". */
export function usePush() {
  return useContext(PushContext);
}

/**
 * The page content that slides right when the phone filter panel opens.
 * Below 600px only (see `.push-page` in globals.css); at 600px and up this is
 * an unstyled block wrapper and is never opened.
 */
export function PushPage({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const value = useMemo(() => ({ open, setOpen, pageRef }), [open]);

  return (
    <PushContext.Provider value={value}>
      <div
        ref={pageRef}
        data-testid="push-page"
        className="push-page"
        data-open={open}
        inert={open}
      >
        {children}
      </div>
    </PushContext.Provider>
  );
}
