import { canonicalUrl } from "@/lib/canonical";

/** Canonical link and og:url for the home page, with the trailing slash the sitemap uses. */
export function HomeUrlTags() {
  const url = canonicalUrl("/");
  return (
    <>
      <link rel="canonical" href={url} />
      <meta property="og:url" content={url} />
    </>
  );
}
