import type { MetadataRoute } from "next";
import { HUBS } from "@/lib/hubs";
import { loadSitemapData } from "@/lib/page-runtime";
import { siteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteUrl();
  const { events, editions, villages, tracks } = await loadSitemapData();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}`, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/speakers`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/defcon/villages`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/tracks`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/topics`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/coverage`, changeFrequency: "weekly", priority: 0.7 },
    ...HUBS.map((hub) => ({
      url: `${baseUrl}${hub.href}`,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    })),
  ];

  const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${baseUrl}/${event.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const editionPages: MetadataRoute.Sitemap = editions.map((edition) => ({
    url: `${baseUrl}/${edition.eventSlug}/${edition.villageSlug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const villagePages: MetadataRoute.Sitemap = villages.map((village) => ({
    url: `${baseUrl}/defcon/villages/${village.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const trackPages: MetadataRoute.Sitemap = tracks.map((track) => ({
    url: `${baseUrl}/tracks/${track.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Talk / speaker / topic detail URLs are omitted so sitemap generation stays
  // light; those pages are served on-demand via dynamicParams.
  return [
    ...staticPages,
    ...eventPages,
    ...editionPages,
    ...villagePages,
    ...trackPages,
  ];
}
