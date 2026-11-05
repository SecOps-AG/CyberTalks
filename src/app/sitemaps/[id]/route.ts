import { sitemapUrlset } from "@/lib/sitemap-build";
import {
  loadSitemapManifest,
  loadSitemapPart,
  sitemapId,
  sitemapXmlResponse,
} from "@/lib/sitemap-data";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const manifest = await loadSitemapManifest();
  const count = manifest?.parts ?? 0;
  return Array.from({ length: count }, (_, id) => ({ id: String(id) }));
}

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const id = sitemapId((await params).id);
  if (id == null) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const paths = await loadSitemapPart(id);
  if (!paths) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return sitemapXmlResponse(sitemapUrlset(siteUrl(), paths));
}
