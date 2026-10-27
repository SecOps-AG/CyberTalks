import type { Metadata } from "next";
import { SearchScreen } from "@/components/search/SearchScreen";
import { DEFAULT_PAGE_SIZE } from "@/lib/search-index/format";
import { canonicalPath, isIndexableQuery } from "@/lib/search-index/href";
import { loadSearchBundle } from "@/lib/search-index/load";
import { parseSearchParams, searchParamsFromRecord, type SearchQuery } from "@/lib/search-index/params";
import { searchTalks } from "@/lib/search-index/query";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function emptyQuery(q = ""): SearchQuery {
  return {
    q,
    terms: [],
    years: [],
    conferences: [],
    tracks: [],
    topics: [],
    difficulties: [],
    sort: "relevance",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = searchParamsFromRecord(await searchParams);
  const parsed = parseSearchParams(params);
  const origin = siteUrl();
  if (!parsed.ok) {
    return {
      title: "Search",
      description: "Search cybersecurity conference talks.",
      alternates: { canonical: `${origin}/search` },
      robots: { index: false, follow: true },
    };
  }
  const path = canonicalPath(parsed.query);
  const title = parsed.query.q ? `${parsed.query.q} — Search` : "Search";
  return {
    title,
    description: parsed.query.q
      ? `Talks matching “${parsed.query.q}” in the Cyber Talks archive.`
      : "Search cybersecurity conference talks by keyword, year, conference, track, topic, and difficulty.",
    alternates: { canonical: `${origin}${path}` },
    robots: isIndexableQuery(parsed.query)
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const params = searchParamsFromRecord(await searchParams);
  const parsed = parseSearchParams(params);
  if (!parsed.ok) {
    return <SearchScreen error={parsed.message} query={emptyQuery(params.get("q") ?? "")} result={null} />;
  }
  try {
    const { index, meta } = await loadSearchBundle();
    const result = searchTalks(index, parsed.query, meta, siteUrl());
    return <SearchScreen error={null} query={parsed.query} result={result} />;
  } catch (error) {
    console.error(error);
    return (
      <SearchScreen
        error="Search index is not available."
        query={parsed.query}
        result={null}
      />
    );
  }
}
