import type { Metadata } from "next";
import Link from "next/link";
import { siteUrl } from "@/lib/site-url";

const origin = siteUrl();

export const metadata: Metadata = {
  title: "API",
  description: "Read-only JSON API for searching the Cyber Talks archive.",
  alternates: { canonical: `${origin}/api` },
};

export default function ApiDocsPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">API</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-[0.06em] text-acid">Search API</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mint/70">
          A public, read-only JSON API for the talk archive. Responses are GET-only, cached for a
          short time, and open to browser clients (<code className="text-cyan">Access-Control-Allow-Origin: *</code>
          ). The same filters drive the <Link href="/search" className="link">search page</Link>.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.16em] text-acid">GET /api/v1/search</h2>
        <p className="max-w-2xl text-sm text-mint/70">
          Returns <code>results</code>, <code>total</code>, paging, and facet counts. Years,
          conferences, tracks, and difficulties combine with OR. Topics combine with AND. Sort is{" "}
          <code>relevance</code> (default) or <code>newest</code>. Page size defaults to 24 and
          caps at 50.
        </p>
        <pre className="panel overflow-x-auto p-4 text-xs leading-relaxed text-mint/80">{`curl '${origin}/api/v1/search?q=ransomware&year=2024&conference=defcon&difficulty=advanced&sort=newest&page=1'

curl '${origin}/api/v1/search?q=osint&pageSize=10'`}</pre>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.16em] text-acid">
          GET /api/v1/talks/{"{id or slug}"}
        </h2>
        <p className="max-w-2xl text-sm text-mint/70">
          One talk. The path accepts the <code>id</code> field from a search result, or the slug
          used on the talk page.
        </p>
        <pre className="panel overflow-x-auto p-4 text-xs leading-relaxed text-mint/80">{`curl '${origin}/api/v1/talks/lockpicking-forensics'

curl '${origin}/api/v1/talks/defcon-17-main-stage-PHE9NnPOH4M'`}</pre>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.16em] text-acid">GET /api/v1/facets</h2>
        <p className="max-w-2xl text-sm text-mint/70">
          Unfiltered counts for year, conference, track, and difficulty, plus the most common
          topics. Topic suggestions on search are capped; any topic slug still works as a filter.
        </p>
        <pre className="panel overflow-x-auto p-4 text-xs leading-relaxed text-mint/80">{`curl '${origin}/api/v1/facets'`}</pre>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.16em] text-acid">Limits</h2>
        <ul className="max-w-2xl list-disc space-y-1.5 pl-5 text-sm text-mint/70">
          <li>Difficulty is beginner, intermediate, advanced, or expert. There is no unknown level.</li>
          <li>Search covers talks. Clips, interviews, and announcements are left out, matching the site default.</li>
          <li>Words are matched whole, case-insensitively. Two-letter minimum. Common words such as “the” are ignored.</li>
          <li>Invalid parameters return 400 with <code>error</code>, <code>field</code>, and <code>message</code>.</li>
          <li>
            Each isolate allows 120 requests per minute per IP. A 429 includes <code>Retry-After</code>.
            That counter is per isolate, not a global quota.
          </li>
          <li>Successful responses send <code>Cache-Control: public, max-age=60</code>.</li>
        </ul>
      </section>
    </div>
  );
}
