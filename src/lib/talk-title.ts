export type TalkTitleFields = {
  title: string;
  eventName: string;
  year: number;
  villageName: string;
  speakers: readonly string[];
  slug: string;
};

export type TitleIndex = {
  duplicateTitles: string[];
  needsVillage: string[];
  needsSpeakers: string[];
  needsSlug: string[];
};

export const EMPTY_TITLE_INDEX: TitleIndex = {
  duplicateTitles: [],
  needsVillage: [],
  needsSpeakers: [],
  needsSlug: [],
};

function speakerList(talk: TalkTitleFields): string {
  return talk.speakers
    .map((name) => name.trim())
    .filter(Boolean)
    .join(", ");
}

function eventKey(talk: TalkTitleFields): string {
  return JSON.stringify([talk.title, talk.eventName, talk.year]);
}

function villageKey(talk: TalkTitleFields): string {
  return JSON.stringify([talk.title, talk.eventName, talk.year, talk.villageName]);
}

function speakerKey(talk: TalkTitleFields): string {
  return JSON.stringify([
    talk.title,
    talk.eventName,
    talk.year,
    talk.villageName,
    speakerList(talk),
  ]);
}

function countGroups(
  talks: readonly TalkTitleFields[],
  keyFor: (talk: TalkTitleFields) => string,
): Map<string, TalkTitleFields[]> {
  const groups = new Map<string, TalkTitleFields[]>();
  for (const talk of talks) {
    const key = keyFor(talk);
    const bucket = groups.get(key);
    if (bucket) bucket.push(talk);
    else groups.set(key, [talk]);
  }
  return groups;
}

/** Titles that occur more than once, and which of those still collide after each suffix. */
export function buildTitleIndex(talks: readonly TalkTitleFields[]): TitleIndex {
  const duplicateTitles: string[] = [];
  const needsVillage: string[] = [];
  const needsSpeakers: string[] = [];
  const needsSlug: string[] = [];

  for (const group of countGroups(talks, (talk) => talk.title).values()) {
    if (group.length < 2) continue;
    duplicateTitles.push(group[0].title);
    for (const [key, eventGroup] of countGroups(group, eventKey)) {
      if (eventGroup.length < 2) continue;
      needsVillage.push(key);
      for (const [vkey, villageGroup] of countGroups(eventGroup, villageKey)) {
        if (villageGroup.length < 2) continue;
        needsSpeakers.push(vkey);
        for (const [skey, speakerGroup] of countGroups(villageGroup, speakerKey)) {
          if (speakerGroup.length > 1) needsSlug.push(skey);
        }
      }
    }
  }

  duplicateTitles.sort();
  needsVillage.sort();
  needsSpeakers.sort();
  needsSlug.sort();
  return { duplicateTitles, needsVillage, needsSpeakers, needsSlug };
}

/**
 * Unique text for the document title. The visible heading stays the talk title.
 * Reused titles gain the event name and year; village, speakers, then slug
 * are added only when that is still not unique.
 */
export function talkDocumentTitle(talk: TalkTitleFields, index: TitleIndex): string {
  if (!index.duplicateTitles.includes(talk.title)) return talk.title;
  const withEvent = `${talk.title} — ${talk.eventName} (${talk.year})`;
  if (!index.needsVillage.includes(eventKey(talk))) return withEvent;
  const withVillage = `${withEvent}, ${talk.villageName}`;
  if (!index.needsSpeakers.includes(villageKey(talk))) return withVillage;
  const names = speakerList(talk);
  const withSpeakers = names ? `${withVillage} — ${names}` : withVillage;
  if (!index.needsSlug.includes(speakerKey(talk))) return withSpeakers;
  return `${withSpeakers} — ${talk.slug}`;
}
