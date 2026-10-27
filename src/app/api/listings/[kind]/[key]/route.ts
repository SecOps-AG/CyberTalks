import { NextResponse } from "next/server";
import { loadSpeaker, loadTopic } from "@/lib/catalog-runtime";
import { talksSql } from "@/lib/d1/binding";
import { readTrackTalks } from "@/lib/d1/read";
import { loadTrackPage } from "@/lib/page-runtime";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ kind: string; key: string }> };

/**
 * Full talk list for a topic, track, or speaker page.
 * The HTML document only includes the first page of cards.
 */
function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(_request: Request, { params }: Params) {
  const { kind, key } = await params;

  if (kind === "topic") {
    const talks = await loadTopic(key);
    if (!talks) return json({ error: "Not found" }, 404);
    return json({ talks });
  }

  if (kind === "speaker") {
    const record = await loadSpeaker(key);
    if (!record) return json({ error: "Not found" }, 404);
    return json({ talks: record.talks });
  }

  if (kind === "track") {
    const db = await talksSql();
    if (db) {
      const talks = await readTrackTalks(db, key);
      if (talks.length === 0) return json({ error: "Not found" }, 404);
      return json({ talks });
    }
    const page = await loadTrackPage(key);
    if (!page) return json({ error: "Not found" }, 404);
    return json({ talks: page.talks });
  }

  return json({ error: "Not found" }, 404);
}
