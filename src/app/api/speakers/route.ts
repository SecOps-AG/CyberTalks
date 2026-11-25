import { NextResponse } from "next/server";
import { loadSpeakerSearch } from "@/lib/page-runtime";
import { SPEAKER_SEARCH_MAX_QUERY, searchSpeakerHits } from "@/lib/speaker-search";

export const dynamic = "force-dynamic";

/**
 * One page of matching names for the speakers directory.
 * Query `q` (at least two characters, capped) and `page` (1-based). The
 * directory ships only the frequent presenters, so this is the search result,
 * not the whole speaker file. Names that are not people are left out, the
 * same way the speakers page leaves them out.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").slice(0, SPEAKER_SEARCH_MAX_QUERY);
  const page = Number(url.searchParams.get("page") ?? "1");
  const rows = await loadSpeakerSearch();
  const people = rows.map(([name, slug, talkCount]) => ({ name, slug, talkCount }));
  const result = searchSpeakerHits(people, query, page);
  return NextResponse.json(
    {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      speakers: result.speakers.map((speaker) => [speaker.name, speaker.slug, speaker.talkCount]),
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
