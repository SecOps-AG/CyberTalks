import type { MetadataRoute } from "next";
import {
  getEditions,
  getEvents,
  getSpeakers,
  getTalks,
  getTopicCounts,
  getTracks,
  getVillageSeries,
} from "@/lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}`, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/speakers`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/villages`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/tracks`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/topics`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/coverage`, changeFrequency: "weekly", priority: 0.7 },
  ];

  const eventPages: MetadataRoute.Sitemap = getEvents().map((event) => ({
    url: `${baseUrl}/${event.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const editionPages: MetadataRoute.Sitemap = getEditions().map((edition) => ({
    url: `${baseUrl}/${edition.eventSlug}/${edition.villageSlug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const villagePages: MetadataRoute.Sitemap = getVillageSeries().map((village) => ({
    url: `${baseUrl}/villages/${village.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const trackPages: MetadataRoute.Sitemap = getTracks().map((track) => ({
    url: `${baseUrl}/tracks/${track.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const topicPages: MetadataRoute.Sitemap = getTopicCounts().map(({ topic }) => ({
    url: `${baseUrl}/topics/${topic}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const speakerPages: MetadataRoute.Sitemap = getSpeakers().map((speaker) => ({
    url: `${baseUrl}/speakers/${speaker.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const talkPages: MetadataRoute.Sitemap = getTalks().map((talk) => ({
    url: `${baseUrl}/talks/${talk.slug}`,
    changeFrequency: "monthly",
    priority: 0.9,
  }));

  return [
    ...staticPages,
    ...eventPages,
    ...editionPages,
    ...villagePages,
    ...trackPages,
    ...topicPages,
    ...speakerPages,
    ...talkPages,
  ];
}
