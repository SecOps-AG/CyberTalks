/** DEF CON 34 landing: event slug, its page, and the site-wide banner copy. */

export const DC34_EVENT_SLUG = "defcon-34";

export const DC34_PATH = `/${DC34_EVENT_SLUG}`;

/**
 * Approved sentence — do not reword. `talkCount` is the DEF CON 34 talk list
 * (the same list as /defcon-34), so the banner cannot drift from that page.
 */
export function dc34BannerText(talkCount: number | null | undefined): string {
  if (talkCount == null || talkCount <= 0) {
    return "DEF CON 34 talks are here, summarized and searchable.";
  }
  return `DEF CON 34 talks are here: ${talkCount.toLocaleString("en-US")} talks, summarized and searchable.`;
}

/** The link label is the only link. */
export const DC34_BANNER = {
  linkLabel: "Browse DEF CON 34",
  href: DC34_PATH,
} as const;

export const DC34_VILLAGE_LABEL = "Village / stage";
