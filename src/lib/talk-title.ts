export type TalkTitleFields = {
  title: string;
  eventName: string;
  year: number;
  /** Full edition name when the event row cannot give it, e.g. "Black Hat USA 2001". */
  eventLabel?: string;
  villageName: string;
  speakers: readonly string[];
  slug: string;
};

/** Search engines cut titles at roughly this many characters. */
export const TITLE_MAX = 60;
const SITE_SUFFIX = " — Cyber Talks";
const SEPARATOR = " | ";
/** Fewest talk-name characters worth keeping before the event label is trimmed instead. */
const MIN_NAME_CHARS = 15;
/** A cut at a word boundary must keep at least this much, or the name is cut mid-word. */
const MIN_WORD_CUT = 8;

/** Same-title talks at the same event and year: the speaker is what tells them apart. */
export type TitleIndex = {
  sameTitle: string[];
};

export const EMPTY_TITLE_INDEX: TitleIndex = { sameTitle: [] };

function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * "DEF CON 33", "Black Hat USA 2001". The event row already carries the year in
 * its name for most conferences ("DEF CON 33", "Black Hat USA 2024"); only a
 * name with no number in it ("Black Hat", "AUSCERT") gets the talk's year added.
 */
export function eventYearLabel(
  talk: Pick<TalkTitleFields, "eventName" | "year" | "eventLabel">,
): string {
  if (talk.eventLabel?.trim()) return talk.eventLabel.trim();
  const name = talk.eventName.trim();
  if (/\d/.test(name)) return name;
  return `${name} ${talk.year}`;
}

/**
 * Shorten a talk name to `limit` characters, deterministically: keep the start
 * of the name (the distinctive part), cut at the last word boundary that fits,
 * and end with "…". A name with no usable boundary is cut mid-word.
 */
export function shortenName(name: string, limit: number): string {
  const text = name.replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const room = Math.max(limit - 1, 1);
  const cut = text.slice(0, room);
  const boundary = cut.lastIndexOf(" ");
  const head = boundary >= Math.min(MIN_WORD_CUT, room) ? cut.slice(0, boundary) : cut;
  return `${head.replace(/[\s,;:.\-–—(]+$/u, "")}…`;
}

/** An edition tag at the start of a name: a short label ending in a year, then a separator. */
const LEADING_TAG = /^([^:|–—-]{0,40}?\b((?:19[89]\d|20[0-2]\d))\b)\s*[-–—:|]?\s*(?=\S)/u;
/** Shortest remainder worth keeping once a leading edition tag is dropped. */
const MIN_REST_CHARS = 8;

/**
 * Channel uploads often title a talk "BSidesSF 2023 - Defining a Data Masking
 * Framework". The event label in the <title> already says which event and year,
 * so the tag is dropped there (the page heading keeps the full name). It is only
 * dropped when the label carries the same year, and never when too little would
 * be left ("RSA Conference 2010 Keynote").
 */
export function withoutEditionTag(name: string, label: string): string {
  const match = LEADING_TAG.exec(name);
  if (!match || !label.includes(match[2])) return name;
  const rest = name.slice(match[0].length).trim();
  return rest.length >= MIN_REST_CHARS ? rest : name;
}

function sameTitleKey(talk: TalkTitleFields): string {
  return `${talk.title}\u0001${eventYearLabel(talk)}`;
}

/** Keys of the (title, event label) pairs that more than one talk shares. */
export function buildTitleIndex(talks: readonly TalkTitleFields[]): TitleIndex {
  const counts = new Map<string, number>();
  for (const talk of talks) {
    const key = sameTitleKey(talk);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sameTitle = [...counts].filter(([, count]) => count > 1).map(([key]) => key);
  sameTitle.sort();
  return { sameTitle };
}

function firstSpeaker(talk: TalkTitleFields): string {
  return talk.speakers.map((name) => name.trim()).find(Boolean) ?? "";
}

/**
 * Text for <title>: `<Talk> | <Event Year>`, at most TITLE_MAX characters
 * where the pieces allow. The visible heading stays the full talk title.
 *
 *  - " — Cyber Talks" is added only if the result still fits in TITLE_MAX.
 *  - A talk name that does not fit is shortened with shortenName; the event
 *    label is never dropped. If the label alone leaves under MIN_NAME_CHARS for
 *    the name, the whole string is shortened instead.
 *  - When the name already contains the event label (or the label contains the
 *    name, as with "2020 Day 2" at "AUSCERT 2020 Day 2"), the longer one is used alone.
 *  - A leading edition tag in the name ("BSidesSF 2023 - ") is dropped when the
 *    label carries the same year (see withoutEditionTag).
 *  - Talks that share a title and event label with other talks get the first
 *    credited speaker after the name, if that fits, so tab titles stay distinct.
 */
export function talkDocumentTitle(talk: TalkTitleFields, index: TitleIndex = EMPTY_TITLE_INDEX): string {
  const label = eventYearLabel(talk);
  const name = withoutEditionTag(talk.title.replace(/\s+/g, " ").trim(), label);
  const foldedName = fold(name);
  const foldedLabel = fold(label);

  let title: string;
  if (foldedLabel && foldedName.includes(foldedLabel)) {
    title = shortenName(name, TITLE_MAX);
  } else if (foldedName && foldedLabel.includes(foldedName)) {
    title = shortenName(label, TITLE_MAX);
  } else {
    let heading = name;
    const speaker = firstSpeaker(talk);
    if (speaker && index.sameTitle.includes(sameTitleKey(talk))) {
      const withSpeaker = `${name} — ${speaker}`;
      if (withSpeaker.length + SEPARATOR.length + label.length <= TITLE_MAX) heading = withSpeaker;
    }
    const room = TITLE_MAX - SEPARATOR.length - label.length;
    if (room >= MIN_NAME_CHARS) {
      title = `${shortenName(heading, room)}${SEPARATOR}${label}`;
    } else {
      title = shortenName(`${heading}${SEPARATOR}${label}`, TITLE_MAX);
    }
  }

  return title.length + SITE_SUFFIX.length <= TITLE_MAX ? `${title}${SITE_SUFFIX}` : title;
}
