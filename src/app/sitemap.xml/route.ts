import { sitemapIndexXml } from "@/lib/sitemap-build";
import { loadSitemapManifest, sitemapXmlResponse } from "@/lib/sitemap-data";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

export async function GET() {
  const manifest = await loadSitemapManifest();
  if (!manifest) {
    return new Response("Sitemap is not built.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return sitemapXmlResponse(sitemapIndexXml(siteUrl(), manifest.parts));
}
