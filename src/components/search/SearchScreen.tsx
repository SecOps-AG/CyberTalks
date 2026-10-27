import type { Difficulty } from "@/lib/types";
import { hrefFromQuery } from "@/lib/search-index/href";
import type { SearchQuery } from "@/lib/search-index/params";
import type { SearchResponse } from "@/lib/search-index/model";
import { DEFAULT_PAGE_SIZE } from "@/lib/search-index/format";

const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  beginner: "border-cyan/50 text-cyan",
  intermediate: "border-acid/50 text-acid",
  advanced: "border-warn/60 text-warn",
  expert: "border-mag/60 text-mag",
};

function toggleNumbers(values: number[], value: number): number[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function toggleStrings(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function HiddenQuery({ query }: { query: SearchQuery }) {
  return (
    <>
      {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
      {query.years.map((year) => (
        <input key={year} type="hidden" name="year" value={year} />
      ))}
      {query.conferences.map((conference) => (
        <input key={conference} type="hidden" name="conference" value={conference} />
      ))}
      {query.tracks.map((track) => (
        <input key={track} type="hidden" name="track" value={track} />
      ))}
      {query.topics.map((topic) => (
        <input key={topic} type="hidden" name="topic" value={topic} />
      ))}
      {query.difficulties.map((difficulty) => (
        <input key={difficulty} type="hidden" name="difficulty" value={difficulty} />
      ))}
      {query.sort === "newest" ? <input type="hidden" name="sort" value="newest" /> : null}
      {query.pageSize !== DEFAULT_PAGE_SIZE ? (
        <input type="hidden" name="pageSize" value={query.pageSize} />
      ) : null}
    </>
  );
}

function FacetLinks({
  label,
  options,
  selected,
  hrefFor,
  scroll = false,
}: {
  label: string;
  options: readonly { value: string | number; label: string; count: number }[];
  selected: readonly (string | number)[];
  hrefFor: (value: string | number) => string;
  scroll?: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <section>
      <p className="label mb-1.5">{label}</p>
      <div className={`scroll-list space-y-0.5 pr-1 ${scroll ? "max-h-40 overflow-y-auto" : ""}`}>
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <a
              key={String(option.value)}
              href={hrefFor(option.value)}
              className="facet"
              data-active={active ? "true" : undefined}
            >
              <span className="facet-box" aria-hidden>
                {active ? "×" : ""}
              </span>
              <span className="flex-1 truncate">{option.label}</span>
              <span className="shrink-0 tabular-nums text-[11px] text-mint/40">{option.count}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

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

function filtersActive(query: SearchQuery): boolean {
  return (
    query.q.trim().length > 0 ||
    query.years.length > 0 ||
    query.conferences.length > 0 ||
    query.tracks.length > 0 ||
    query.topics.length > 0 ||
    query.difficulties.length > 0 ||
    query.sort !== "relevance"
  );
}

export function SearchScreen({
  error,
  query,
  result,
}: {
  error: string | null;
  query: SearchQuery;
  result: SearchResponse | null;
}) {
  const facets = result?.facets;
  const from = result && result.results.length > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const to = from === 0 || !result ? 0 : from + result.results.length - 1;

  const panel = (
    <div className="space-y-5">
      {facets ? (
        <>
          <FacetLinks
            label="Year"
            options={facets.years}
            selected={query.years}
            scroll
            hrefFor={(value) =>
              hrefFromQuery({ ...query, years: toggleNumbers(query.years, Number(value)), page: 1 })
            }
          />
          <FacetLinks
            label="Conference"
            options={facets.conferences}
            selected={query.conferences}
            scroll
            hrefFor={(value) =>
              hrefFromQuery({
                ...query,
                conferences: toggleStrings(query.conferences, String(value)),
                page: 1,
              })
            }
          />
          <FacetLinks
            label="Track"
            options={facets.tracks}
            selected={query.tracks}
            scroll
            hrefFor={(value) =>
              hrefFromQuery({ ...query, tracks: toggleStrings(query.tracks, String(value)), page: 1 })
            }
          />
          <FacetLinks
            label="Difficulty"
            options={facets.difficulties}
            selected={query.difficulties}
            hrefFor={(value) =>
              hrefFromQuery({
                ...query,
                difficulties: toggleStrings(query.difficulties, String(value)) as Difficulty[],
                page: 1,
              })
            }
          />
          <section>
            <p className="label mb-1.5">Topic</p>
            {query.topics.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {query.topics.map((topic) => (
                  <a
                    key={topic}
                    href={hrefFromQuery({
                      ...query,
                      topics: query.topics.filter((item) => item !== topic),
                      page: 1,
                    })}
                    className="chip"
                    data-active="true"
                  >
                    {facets.topics.find((item) => item.value === topic)?.label ?? topic}
                    <span aria-hidden>×</span>
                  </a>
                ))}
              </div>
            ) : null}
            <form action="/search" method="get">
              <HiddenQuery query={query} />
              <input
                type="search"
                name="topic"
                placeholder="Add a topic…"
                aria-label="Add a topic"
                className="field !py-1 text-[12px]"
              />
            </form>
            {facets.topics.filter((topic) => !query.topics.includes(topic.value)).length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {facets.topics
                  .filter((topic) => !query.topics.includes(topic.value) && topic.count > 0)
                  .slice(0, 8)
                  .map((topic) => (
                    <a
                      key={topic.value}
                      href={hrefFromQuery({ ...query, topics: [...query.topics, topic.value], page: 1 })}
                      className="chip"
                    >
                      {topic.label}
                      <span className="text-mint/40">{topic.count}</span>
                    </a>
                  ))}
              </div>
            ) : null}
            {facets.topicsTruncated ? (
              <p className="mt-1.5 text-[10px] text-mint/40">Showing the most common topics.</p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Search</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-[0.06em] text-acid">Search talks</h1>
        <p className="mt-1 max-w-2xl text-sm text-mint/60">
          Shareable results across the archive. Difficulty is beginner, intermediate, advanced, or expert.
        </p>
      </header>

      <form action="/search" method="get" className="panel flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <label htmlFor="archive-search" className="sr-only">
          Search talks
        </label>
        <span aria-hidden className="text-acid/70">
          &gt;
        </span>
        <input
          id="archive-search"
          type="search"
          name="q"
          defaultValue={query.q}
          placeholder="Search titles, speakers, villages, topics…"
          className="w-full bg-transparent font-mono text-base text-mint outline-none placeholder:text-mint/30 [&::-webkit-search-cancel-button]:hidden"
        />
        {query.years.map((year) => (
          <input key={`y-${year}`} type="hidden" name="year" value={year} />
        ))}
        {query.conferences.map((conference) => (
          <input key={`c-${conference}`} type="hidden" name="conference" value={conference} />
        ))}
        {query.tracks.map((track) => (
          <input key={`t-${track}`} type="hidden" name="track" value={track} />
        ))}
        {query.topics.map((topic) => (
          <input key={`p-${topic}`} type="hidden" name="topic" value={topic} />
        ))}
        {query.difficulties.map((difficulty) => (
          <input key={`d-${difficulty}`} type="hidden" name="difficulty" value={difficulty} />
        ))}
        {query.sort === "newest" ? <input type="hidden" name="sort" value="newest" /> : null}
        {query.pageSize !== DEFAULT_PAGE_SIZE ? (
          <input type="hidden" name="pageSize" value={query.pageSize} />
        ) : null}
        <button type="submit" className="chip shrink-0">
          Search
        </button>
      </form>

      {error ? (
        <p className="panel px-4 py-3 text-sm text-warn" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className="hidden lg:block">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-xs uppercase tracking-[0.2em] text-acid">Filters</p>
              {filtersActive(query) ? (
                <a href="/search" className="text-[11px] text-mag hover:text-acid">
                  Clear
                </a>
              ) : null}
            </div>
            {panel}
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <details className="panel group lg:hidden">
            <summary className="cursor-pointer list-none px-4 py-3 font-display text-xs uppercase tracking-[0.2em] text-acid">
              Filters
              <span className="float-right text-mint/50 group-open:hidden">+</span>
              <span className="float-right hidden text-mint/50 group-open:inline">−</span>
            </summary>
            <div className="border-t border-acid/15 p-4">{panel}</div>
          </details>

          {result ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-mint/60">
                  {result.total === 0
                    ? "0 talks"
                    : `${from}–${to} of ${result.total.toLocaleString("en-US")} talk${result.total === 1 ? "" : "s"}`}
                </p>
                <div className="flex items-center gap-2">
                  <span className="label">Sort</span>
                  <a
                    href={hrefFromQuery({ ...query, sort: "relevance", page: 1 })}
                    className="chip"
                    data-active={query.sort === "relevance" ? "true" : undefined}
                  >
                    Relevance
                  </a>
                  <a
                    href={hrefFromQuery({ ...query, sort: "newest", page: 1 })}
                    className="chip"
                    data-active={query.sort === "newest" ? "true" : undefined}
                  >
                    Newest
                  </a>
                </div>
              </div>

              {result.results.length === 0 ? (
                <div className="panel px-4 py-12 text-center">
                  <p className="text-sm uppercase tracking-[0.16em] text-warn">No talks match these filters.</p>
                  {filtersActive(query) ? (
                    <a href="/search" className="link mt-4 inline-block text-[11px] uppercase">
                      Clear filters
                    </a>
                  ) : null}
                </div>
              ) : (
                <ol className="space-y-3">
                  {result.results.map((hit) => (
                    <li key={hit.id}>
                      <article className="panel px-4 py-3">
                        <p className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-mint/55">
                          <span>
                            {hit.conferenceLabel} · {hit.year}
                          </span>
                          <span className="text-mint/30">{hit.event}</span>
                          {hit.difficulty ? (
                            <span
                              className={`rounded-sm border bg-void/90 px-1.5 py-0.5 ${DIFFICULTY_BADGE[hit.difficulty]}`}
                            >
                              {hit.difficulty}
                            </span>
                          ) : null}
                        </p>
                        <h2 className="mt-1 font-display text-base font-semibold leading-snug text-acid">
                          <a href={`/talks/${hit.slug}`} className="hover:text-cyan">
                            {hit.title}
                          </a>
                        </h2>
                        {hit.speakers.length > 0 ? (
                          <p className="mt-1 text-xs text-mint/65">{hit.speakers.join(" · ")}</p>
                        ) : null}
                      </article>
                    </li>
                  ))}
                </ol>
              )}

              {result.totalPages > 1 ? (
                <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
                  {result.page > 1 ? (
                    <a href={hrefFromQuery({ ...query, page: result.page - 1 })} className="chip">
                      Prev
                    </a>
                  ) : null}
                  {pageWindow(result.page, result.totalPages).map((entry, index) =>
                    entry === "gap" ? (
                      <span key={`gap-${index}`} className="px-1 text-mint/30">
                        …
                      </span>
                    ) : (
                      <a
                        key={entry}
                        href={hrefFromQuery({ ...query, page: entry })}
                        className="chip tabular-nums"
                        data-active={entry === result.page ? "true" : undefined}
                        aria-current={entry === result.page ? "page" : undefined}
                      >
                        {entry}
                      </a>
                    ),
                  )}
                  {result.page < result.totalPages ? (
                    <a href={hrefFromQuery({ ...query, page: result.page + 1 })} className="chip">
                      Next
                    </a>
                  ) : null}
                </nav>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
