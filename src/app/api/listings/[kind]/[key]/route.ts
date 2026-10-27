import { NextResponse } from "next/server";
import { loadSpeaker, loadTopic } from "@/lib/catalog-runtime";
import { loadTrackPage } from "@/lib/page-runtime";

type Params = { params: Promise<{ kind: string; key: string }> };

/**
 * Full talk list for a topic, track, or speaker page.
 *
 * The HTML document only includes the first page of cards. The browser loads
 * the rest from a catalog shard when one exists, and from this route in dev.
 */
export async function GET(_request: Request, { params }: Params) {
  const { kind, key } = await params;

  if (kind === "topic") {
    const talks = await loadTopic(key);
    if (!talks) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ talks });
  }

  if (kind === "speaker") {
    const record = await loadSpeaker(key);
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ talks: record.talks });
  }

  if (kind === "track") {
    const page = await loadTrackPage(key);
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ talks: page.talks });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
