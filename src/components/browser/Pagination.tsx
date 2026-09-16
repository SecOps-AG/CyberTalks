"use client";

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

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
      <button
        type="button"
        className="chip disabled:opacity-30 disabled:hover:border-acid/25 disabled:hover:text-mint"
        onClick={() => onChange(page - 1)}
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
            onClick={() => onChange(entry)}
          >
            {entry}
          </button>
        ),
      )}
      <button
        type="button"
        className="chip disabled:opacity-30 disabled:hover:border-acid/25 disabled:hover:text-mint"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        Next
      </button>
    </nav>
  );
}
