import { talksSql } from "@/lib/d1/binding";
import { readTalkById, readTalkBySlug } from "@/lib/d1/read";
import { isYouTubeId, publicMaterialBands } from "@/lib/materials";
import { siteUrl } from "@/lib/site-url";
import { apiJson, apiOptions, limitRequest, rateLimited } from "@/lib/search-index/http";
import { loadSearchBundle } from "@/lib/search-index/load";
import type { TalkDetail } from "@/lib/search-index/model";
import { parseTalkId } from "@/lib/search-index/params";
import { detailFromTalk, getTalkByIdOrSlug } from "@/lib/search-index/query";
import type { Talk } from "@/lib/types";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function withStoredMaterials(talk: TalkDetail, body: Talk): TalkDetail {
  const bands = publicMaterialBands(body.materials);
  return {
    ...talk,
    youtubeUrl: isYouTubeId(body.youtubeId) ? `https://www.youtube.com/watch?v=${body.youtubeId}` : "",
    mediaUrl: body.mediaUrl || null,
    materials: bands.materials,
    moreMaterials: bands.moreMaterials,
  };
}

export function OPTIONS() {
  return apiOptions();
}

export async function GET(request: Request, context: Context) {
  const decision = limitRequest(request);
  if (!decision.ok) return rateLimited(decision);

  const { id } = await context.params;
  const parsed = parseTalkId(id);
  if (!parsed.ok) {
    return apiJson(
      { error: parsed.error, field: parsed.field, message: parsed.message },
      parsed.status,
      decision,
      "none",
    );
  }

  try {
    const origin = siteUrl();
    const db = await talksSql().catch(() => null);
    let talk: TalkDetail | null = null;
    try {
      const { index } = await loadSearchBundle();
      talk = getTalkByIdOrSlug(index, parsed.id, origin);
    } catch (error) {
      if (!db) throw error;
      console.error(error);
    }
    if (db) {
      const record = talk
        ? await readTalkBySlug(db, talk.slug)
        : await readTalkBySlug(db, parsed.id);
      const body = record?.talk ?? (await readTalkById(db, parsed.id));
      if (!talk && body) talk = detailFromTalk(body, origin);
      else if (talk && body) talk = withStoredMaterials(talk, body);
    }
    if (!talk) {
      return apiJson(
        { error: "not_found", message: "No talk with that id or slug." },
        404,
        decision,
        "short",
      );
    }
    return apiJson({ talk }, 200, decision, "public");
  } catch (error) {
    console.error(error);
    return apiJson(
      { error: "index_unavailable", message: "Search index is not available." },
      500,
      decision,
      "none",
    );
  }
}
