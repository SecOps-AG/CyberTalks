"use client";

import Link from "next/link";

function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push("gap");
    out.push(page);
    previous = page;
  }
  return out;
}

/** Page 1 is the bare path, so the first page keeps its canonical URL. */
function pageHref(base: string, page: number): string {
  return page <= 1 ? base : `${base}?page=${page}`;
}

/**
 * Buttons by default. With `hrefBase` the same chips are plain links
 * (`<base>?page=N`), so a server-rendered list pages without JavaScript.
 */
export function Pagination({
  page,
  totalPages,
  onChange,
  hrefBase,
  onIntent,
}: {
  page: number;
  totalPages: number;
  onChange?: (page: number) => void;
  hrefBase?: string;
  /** Fires when the pointer or focus first lands on the controls. */
  onIntent?: () => void;
}) {
  if (totalPages <= 1) return null;

  if (hrefBase) {
    const disabled = "chip opacity-30";
    return (
      <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
        {page <= 1 ? (
          <span className={disabled} aria-disabled="true">
            Prev
          </span>
        ) : (
          <Link href={pageHref(hrefBase, page - 1)} className="chip" rel="prev">
            Prev
          </Link>
        )}
        {pageWindow(page, totalPages).map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-mint/30">
              …
            </span>
          ) : (
            <Link
              key={entry}
              href={pageHref(hrefBase, entry)}
              className="chip tabular-nums"
              data-active={entry === page}
              aria-current={entry === page ? "page" : undefined}
            >
              {entry}
            </Link>
          ),
        )}
        {page >= totalPages ? (
          <span className={disabled} aria-disabled="true">
            Next
          </span>
        ) : (
          <Link href={pageHref(hrefBase, page + 1)} className="chip" rel="next">
            Next
          </Link>
        )}
      </nav>
    );
  }

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-1.5"
      aria-label="Pagination"
      onPointerDownCapture={onIntent}
      onFocusCapture={onIntent}
    >
      <button
        type="button"
        className="chip disabled:opacity-30 disabled:hover:border-acid/25 disabled:hover:text-mint"
        onClick={() => onChange?.(page - 1)}
        disabled={page <= 1}
      >
        Prev
      </button>
      {pageWindow(page, totalPages).map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-mint/30">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            className="chip tabular-nums"
            data-active={entry === page}
            aria-current={entry === page ? "page" : undefined}
            onClick={() => onChange?.(entry)}
          >
            {entry}
          </button>
        ),
      )}
      <button
        type="button"
        className="chip disabled:opacity-30 disabled:hover:border-acid/25 disabled:hover:text-mint"
        onClick={() => onChange?.(page + 1)}
        disabled={page >= totalPages}
      >
        Next
      </button>
    </nav>
  );
}
