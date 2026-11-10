import { canonicalUrl } from "./canonical";
import { isYouTubeId, thumbnailSrc } from "./materials";
import { siteUrl } from "./site-url";
import type { Talk } from "./types";

type JsonLd = Record<string, unknown>;

const SITE_NAME = "Cyber Talks";

/**
 * JSON for an inline <script type="application/ld+json">. `<` is escaped so a
 * title containing "</script>" cannot end the element early.
 */
export function jsonLdString(data: JsonLd): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function homeJsonLd(): JsonLd[] {
  const origin = siteUrl();
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      url: canonicalUrl("/"),
      name: SITE_NAME,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${origin}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: SITE_NAME,
      url: canonicalUrl("/"),
      logo: `${origin}/icon-512.png`,
    },
  ];
}

/** The teaser we wrote for the talk, or a plain who/where line when it has none. */
export function talkDescription(
  talk: Pick<Talk, "teaser" | "speakers" | "villageName" | "eventName">,
): string {
  return talk.teaser || `${talk.speakers.join(", ")} — ${talk.villageName}, ${talk.eventName}.`;
}

/** "PT1H2M3S" for a positive whole number of seconds, otherwise undefined. */
export function isoDuration(seconds: number | undefined): string | undefined {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}

function absolute(url: string): string {
  return url.startsWith("/") ? `${siteUrl()}${url}` : url;
}

type TalkLd = Pick<
  Talk,
  | "slug"
  | "title"
  | "teaser"
  | "speakers"
  | "villageName"
  | "eventName"
  | "youtubeId"
  | "mediaUrl"
  | "durationSeconds"
  | "publishedAt"
  | "language"
  | "topics"
>;

/**
 * VideoObject when the page has a player (YouTube or the media archive),
 * CreativeWork when it does not. The description is always the teaser.
 */
export function talkJsonLd(talk: TalkLd): JsonLd {
  const url = canonicalUrl(`/talks/${encodeURIComponent(talk.slug)}`);
  const youtube = isYouTubeId(talk.youtubeId);
  const video = youtube || Boolean(talk.mediaUrl);

  const common: JsonLd = {
    "@context": "https://schema.org",
    "@type": video ? "VideoObject" : "CreativeWork",
    "@id": `${url}#talk`,
    url,
    mainEntityOfPage: url,
    name: talk.title,
    description: talkDescription(talk),
    ...(talk.speakers.length
      ? { creator: talk.speakers.map((name) => ({ "@type": "Person", name })) }
      : {}),
    ...(talk.topics.length ? { keywords: talk.topics.join(", ") } : {}),
    ...(talk.language ? { inLanguage: talk.language } : {}),
    ...(talk.publishedAt ? { [video ? "uploadDate" : "datePublished"]: talk.publishedAt } : {}),
  };
  if (!video) return common;

  const duration = isoDuration(talk.durationSeconds);
  return {
    ...common,
    thumbnailUrl: absolute(thumbnailSrc(talk.youtubeId)),
    ...(duration ? { duration } : {}),
    ...(youtube
      ? { embedUrl: `https://www.youtube.com/embed/${talk.youtubeId}` }
      : { contentUrl: talk.mediaUrl }),
  };
}

export function speakerJsonLd(speaker: { slug: string; name: string }): JsonLd {
  const url = canonicalUrl(`/speakers/${encodeURIComponent(speaker.slug)}`);
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${url}#person`,
    url,
    mainEntityOfPage: url,
    name: speaker.name,
    description: `Every talk by ${speaker.name} on ${SITE_NAME}.`,
  };
}

