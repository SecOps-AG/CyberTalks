import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Legacy endpoint. The full catalog is too large for a single JSON response
 * (Vercel FALLBACK_BODY_TOO_LARGE). Clients should load year shards from
 * /data/talk-index/ instead; this route only advertises the year list.
 */
export function GET() {
  const yearsPath = path.join(process.cwd(), "public", "data", "talk-index", "years.json");
  if (!fs.existsSync(yearsPath)) {
    return NextResponse.json(
      { years: [], shards: "/data/talk-index/talks-{year}.json" },
      { status: 503 },
    );
  }
  const years: number[] = JSON.parse(fs.readFileSync(yearsPath, "utf8"));
  return NextResponse.json({
    years,
    shards: "/data/talk-index/talks-{year}.json",
  });
}
