import { cache } from "react";
import { readPublicJson } from "./catalog-runtime";
import { sitemapCacheHeaders } from "./http-cache";

export const sitemapManifestPath = "/catalog/sitemaps/manifest.json";

export type SitemapManifest = { parts: number };

export type SitemapPart = { paths: string[] };

export function sitemapPartPath(id: number): string {
  return `/catalog/sitemaps/${id}.json`;
}

export const loadSitemapManifest = cache(async (): Promise<SitemapManifest | null> => {
  const file = await readPublicJson<SitemapManifest>(sitemapManifestPath);
  if (!file || !Number.isInteger(file.parts) || file.parts < 1) return null;
  return file;
});

export async function loadSitemapPart(id: number): Promise<string[] | null> {
  if (!Number.isInteger(id) || id < 0) return null;
  const file = await readPublicJson<SitemapPart>(sitemapPartPath(id));
  if (!file || !Array.isArray(file.paths)) return null;
  return file.paths;
}

export function sitemapXmlResponse(xml: string, status = 200): Response {
  const headers = new Headers(status === 200 ? sitemapCacheHeaders() : { "Cache-Control": "no-store" });
  if (status === 200) headers.set("Content-Type", "application/xml; charset=utf-8");
  return new Response(xml, { status, headers });
}

export function sitemapId(raw: string): number | null {
  const value = raw.endsWith(".xml") ? raw.slice(0, -4) : raw;
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) ? id : null;
}
