import { inDefconVillage } from "../hubs";
import { slugifySpeaker } from "../search";
import type { Speaker, Talk } from "../types";

/**
 * One speaker, from the talks that credit them.
 * Same rules as getSpeakers in the disk archive: most-used spelling, DEF CON
 * villages only, co-speakers by slug.
 */
export function speakerFromTalks(slug: string, talks: Talk[]): Speaker | null {
  if (!slug) return null;

  const spellings = new Map<string, number>();
  let talkCount = 0;
  const years = new Set<number>();
  const villages = new Set<string>();
  const coSpeakers = new Set<string>();

  for (const talk of talks) {
    let credited = false;
    for (const name of talk.speakers) {
      if (slugifySpeaker(name) !== slug) continue;
      credited = true;
      spellings.set(name, (spellings.get(name) ?? 0) + 1);
      talkCount += 1;
    }
    if (!credited) continue;

    years.add(talk.year);
    if (inDefconVillage(talk)) villages.add(talk.villageSlug);
    for (const name of talk.speakers) {
      const other = slugifySpeaker(name);
      if (other && other !== slug) coSpeakers.add(other);
    }
  }

  if (talkCount === 0 || spellings.size === 0) return null;
  const sortedYears = [...years].sort((a, b) => b - a);
  const name = [...spellings.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0][0];

  return {
    slug,
    name,
    talkCount,
    yearsActive: sortedYears,
    villages: [...villages].sort(),
    firstAppearance: Math.min(...sortedYears),
    lastAppearance: Math.max(...sortedYears),
    coSpeakers: [...coSpeakers].sort(),
  };
}
