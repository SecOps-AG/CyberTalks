import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Facet and query combinations on /search are an open crawl graph.
      // The clean /search URL, and every talk, speaker, track, topic, and
      // conference page, stay allowed.
      disallow: "/search?",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
