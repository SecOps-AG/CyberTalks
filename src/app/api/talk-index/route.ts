import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Legacy endpoint. The full catalog is too large for a single JSON response
 * (CDN body size limit). Clients should load chunks from /data/talk-index/
 * via manifest.json; this route only advertises the thin manifest shape.
 */
export function GET() {
  const indexDir = path.join(process.cwd(), "public", "data", "talk-index");
  const manifestPath = path.join(indexDir, "manifest.json");
  const yearsPath = path.join(indexDir, "years.json");

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      version: number;
      years: number[];
      chunks: Record<string, unknown[]>;
    };
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

  if (fs.existsSync(yearsPath)) {
    const years: number[] = JSON.parse(fs.readFileSync(yearsPath, "utf8"));
    return NextResponse.json({
      version: 1,
      years,
      manifest: null,
      shards: "/data/talk-index/talks-{year}.json",
    });
  }

  return NextResponse.json(
    { years: [], manifest: null, shards: "/data/talk-index/talks-{year}.json" },
    { status: 503 },
  );
}
