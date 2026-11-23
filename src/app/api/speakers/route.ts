import { NextResponse } from "next/server";
import { loadSpeakerSearch } from "@/lib/page-runtime";
import { searchSpeakerHits } from "@/lib/speaker-search";

export const dynamic = "force-dynamic";

/**
 * One page of name matches for the speakers directory.
 * Query `q` (at least two characters) and `page` (1-based). The directory
 * ships only the frequent presenters, so this is the search result, not the
 * whole speaker file.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
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
