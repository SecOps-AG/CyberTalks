import { NextResponse } from "next/server";
import { loadSpeakers } from "@/lib/page-runtime";
import { isLikelyPersonSpeaker } from "@/lib/speakerHeuristics";

export const dynamic = "force-dynamic";

/**
 * Names for the speaker search box: [name, slug, talkCount] per person.
 * The /speakers document only carries the frequent presenters; this loads the
 * rest the first time someone uses the search field.
 */
export async function GET() {
  const speakers = await loadSpeakers();
  const rows = speakers
    .filter((speaker) => isLikelyPersonSpeaker(speaker.name))
    .map((speaker) => [speaker.name, speaker.slug, speaker.talkCount] as const);
  return NextResponse.json(
    { speakers: rows },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
