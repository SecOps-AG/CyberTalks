import { NextResponse } from "next/server";
import { readPublicJson } from "@/lib/catalog-runtime";
import { talksSql } from "@/lib/d1/binding";
import { readYearSummaries } from "@/lib/d1/read";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ year: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(_request: Request, { params }: Params) {
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) return json({ error: "Not found" }, 404);

  const db = await talksSql();
  if (db) return json(await readYearSummaries(db, Number(year)));

  const fallback = await readPublicJson<unknown>(`/data/summaries/summaries-${year}.json`);
  if (!fallback) return json([]);
  return json(fallback);
}
