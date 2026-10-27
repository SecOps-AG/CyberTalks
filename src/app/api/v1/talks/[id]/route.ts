import { siteUrl } from "@/lib/site-url";
import { apiJson, apiOptions, limitRequest, rateLimited } from "@/lib/search-index/http";
import { loadSearchBundle } from "@/lib/search-index/load";
import { parseTalkId } from "@/lib/search-index/params";
import { getTalkById } from "@/lib/search-index/query";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

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
    const { index } = await loadSearchBundle();
    const talk = getTalkById(index, parsed.id, siteUrl());
    if (!talk) {
      return apiJson(
        { error: "not_found", message: "No talk with that id." },
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
