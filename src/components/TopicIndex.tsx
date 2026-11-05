import Link from "next/link";
import { TOPIC_FILTER_LIMIT, TOPIC_INDEX_MIN, type TopicIndexView } from "@/lib/topic-indexability";

function topicHref(topic: string): string {
  return `/topics/${encodeURIComponent(topic)}`;
}

/**
 * Hubs are real links in the HTML. The filter is a GET form, so a query
 * returns the same document to a browser and a crawler.
 */
export function TopicIndex({ view }: { view: TopicIndexView }) {
  const query = view.query;

  return (
    <div className="space-y-8">
      <form method="get" action="/topics" className="flex max-w-md items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Filter topics…"
          aria-label="Filter topics"
          className="field"
        />
        <button
          type="submit"
          className="shrink-0 rounded-sm border border-acid/40 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-acid hover:border-acid"
        >
          Filter
        </button>
      </form>

      {!query && view.featured.length > 0 ? (
        <section>
          <h2 className="mb-3 border-b border-acid/15 pb-2 font-display text-xs uppercase tracking-[0.2em] text-cyan">
            Most used
          </h2>
          <div className="flex flex-wrap gap-2">
            {view.featured.map((entry) => (
              <Link key={entry.topic} href={topicHref(entry.topic)} className="chip !normal-case !tracking-normal">
                {entry.label}
                <span className="text-[10px] text-mint/40">{entry.count}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 border-b border-acid/15 pb-2 font-display text-xs uppercase tracking-[0.2em] text-cyan">
          {query
            ? `${view.totalMatches.toLocaleString("en-US")} matching`
            : `${view.hubCount.toLocaleString("en-US")} topic hubs`}
        </h2>
        {query ? (
          <p className="mb-3 text-[12px] text-mint/45">
            <Link href="/topics" className="link">
              Topic hubs
            </Link>
            {view.truncated
              ? ` · showing ${TOPIC_FILTER_LIMIT.toLocaleString("en-US")} of ${view.totalMatches.toLocaleString("en-US")}. Narrow the filter.`
              : null}
          </p>
        ) : (
          <p className="mb-3 text-[12px] text-mint/45">
            Hubs have {TOPIC_INDEX_MIN} or more talks. The filter searches every topic.
          </p>
        )}
        {view.listed.length === 0 ? (
          <p className="text-sm text-mint/50">No topic matches “{query}”.</p>
        ) : (
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {view.listed.map((entry) => (
              <li key={entry.topic}>
                <Link
                  href={topicHref(entry.topic)}
                  className="flex items-baseline justify-between gap-3 border-b border-acid/10 py-1.5 text-[13px] text-mint/80 transition hover:text-acid"
                >
                  <span className="truncate">{entry.label}</span>
                  <span className="shrink-0 tabular-nums text-[11px] text-mint/35">{entry.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
