import { apiJson, apiOptions, limitRequest, rateLimited } from "@/lib/search-index/http";
import { loadSearchBundle } from "@/lib/search-index/load";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

export async function GET(request: Request) {
  const decision = limitRequest(request);
  if (!decision.ok) return rateLimited(decision);

  try {
    const { meta } = await loadSearchBundle();
    return apiJson(
      {
        talks: meta.talks,
        sourceRecords: meta.sourceRecords,
        indexedKinds: meta.indexedKinds,
        years: meta.years,
        conferences: meta.conferences,
        tracks: meta.tracks,
        difficulties: meta.difficulties,
        topics: meta.topicsTop,
        topicTotal: meta.topicTotal,
        topicsTruncated: meta.topicTotal > meta.topicsTop.length,
      },
      200,
      decision,
      "public",
    );
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
