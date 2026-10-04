import { NextResponse } from "next/server";
import manifest from "../../../../public/data/talk-index/manifest.json";

export const dynamic = "force-static";

/**
 * Legacy endpoint. The full catalog is too large for a single JSON response
 * (CDN body size limit). Clients should load chunks from /data/talk-index/
 * via manifest.json; this route only advertises the thin manifest shape.
 */
export function GET() {
  return NextResponse.json({
    version: manifest.version,
    years: manifest.years,
    manifest: "/data/talk-index/manifest.json",
    chunkCount: Object.values(manifest.chunks).reduce(
      (sum, yearChunks) => sum + yearChunks.length,
      0,
    ),
  });
}
