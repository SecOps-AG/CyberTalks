/** DEF CON 34 landing: event slug, its page, and the site-wide banner copy. */

export const DC34_EVENT_SLUG = "defcon-34";

export const DC34_PATH = `/${DC34_EVENT_SLUG}`;

/** Approved copy — do not reword. The link label is the only link. */
export const DC34_BANNER = {
  text: "DEF CON 34 talks are here: 354 talks, summarized and searchable.",
  linkLabel: "Browse DEF CON 34",
  href: DC34_PATH,
} as const;

export const DC34_VILLAGE_LABEL = "Village / stage";
