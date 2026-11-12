import type { Metadata } from "next";
import { canonicalUrl } from "./canonical";
import { siteUrl } from "./site-url";

/** Site-wide description, also used on the home page. */
export const SITE_DESCRIPTION =
  "Cyber Talks: a searchable archive of cybersecurity conference talks from DEF CON, Black Hat, RSAC, and TROOPERS, with YouTube video and written summaries.";

/** Social card for every page that is not a talk. Talks use their own thumbnail. */
export const DEFAULT_OG_IMAGE_PATH = "/og-default.png";
export const DEFAULT_OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const DEFAULT_OG_IMAGE_ALT = "Cyber Talks, a conference talk archive";

export function defaultOgImageUrl(): string {
  return `${siteUrl()}${DEFAULT_OG_IMAGE_PATH}`;
}

type PageMetaInput = {
  /** Shown in the tab and on cards. Omit on the home page to use the site title. */
  title?: string;
  description: string;
  /** Site path, e.g. "/defcon". */
  path: string;
};

/**
 * Home page metadata without `alternates.canonical` and `openGraph.url`.
 *
 * Next writes a root URL without its trailing slash, which would disagree with
 * the sitemap entry. The home page renders both tags itself (see
 * `HomeUrlTags`), so the Metadata API must not emit a second, conflicting pair.
 */
export function homeMetadata(description: string): Metadata {
  const { alternates: _alternates, openGraph, ...rest } = pageMetadata({ description, path: "/" });
  const { url: _url, ...og } = (openGraph ?? {}) as Record<string, unknown>;
  return { ...rest, openGraph: og as Metadata["openGraph"] };
}

/**
 * Title, description, canonical, Open Graph and Twitter tags for a non-talk page.
 *
 * Next replaces the whole openGraph and twitter objects when a page sets them,
 * so every field has to be repeated here rather than inherited from the layout.
 */
export function pageMetadata({ title, description, path }: PageMetaInput): Metadata {
  const url = canonicalUrl(path);
  const cardTitle = title ? `${title} — Cyber Talks` : "Cyber Talks";
  const image = defaultOgImageUrl();
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Cyber Talks",
      title: cardTitle,
      description,
      url,
      images: [{ url: image, ...DEFAULT_OG_IMAGE_SIZE, alt: DEFAULT_OG_IMAGE_ALT }],
    },
    twitter: {
      card: "summary_large_image",
      title: cardTitle,
      description,
      images: [image],
    },
  };
}
