import { siteUrl } from "@/lib/site-url";
import { apiJson, apiOptions, limitRequest, rateLimited } from "@/lib/search-index/http";
import { loadSearchBundle } from "@/lib/search-index/load";
import { parseSearchParams } from "@/lib/search-index/params";
import { searchTalks } from "@/lib/search-index/query";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

export async function GET(request: Request) {
  const decision = limitRequest(request);
  if (!decision.ok) return rateLimited(decision);

  const parsed = parseSearchParams(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return apiJson(
      { error: parsed.error, field: parsed.field, message: parsed.message },
      parsed.status,
      decision,
      "none",
    );
  }

  try {
    const { index, meta } = await loadSearchBundle();
    const body = searchTalks(index, parsed.query, meta, siteUrl());
    return apiJson(body, 200, decision, "public");
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
