import { NextResponse } from "next/server";
import { readPublicJson } from "@/lib/catalog-runtime";
import { talksSql } from "@/lib/d1/binding";
import { readManifest, readTalkIndexFile } from "@/lib/d1/read";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ file: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(_request: Request, { params }: Params) {
  const { file } = await params;
  if (!/^[a-z0-9.-]+$/i.test(file)) return json({ error: "Not found" }, 404);

  const db = await talksSql();
  if (db) {
    if (file === "manifest.json") return json(await readManifest(db));
    const talks = await readTalkIndexFile(db, file);
    if (!talks) return json({ error: "Not found" }, 404);
    return json(talks);
  }

  const fallback = await readPublicJson<unknown>(`/data/talk-index/${file}`);
  if (!fallback) return json({ error: "Not found" }, 404);
  return json(fallback);
}
