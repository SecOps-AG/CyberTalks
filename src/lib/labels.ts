/**
 * Short display labels for card chips. Pure — safe on server and client.
 */
import type { Difficulty } from "./types";

/** Display names for the `conference` family slug stored on each village file. */
const CONFERENCE_LABELS: Record<string, string> = {
  defcon: "DEF CON",
  "black-hat": "Black Hat",
  rsa: "RSAC",
  troopers: "TROOPERS",
  bsides: "BSides",
};

/** Homepage hero: name these families, in this order, when they have talks. */
export const S_TIER_CONFERENCES: { slugs: readonly string[]; label: string }[] = [
  { slugs: ["defcon"], label: "DEF CON" },
  { slugs: ["black-hat", "blackhat"], label: "Black Hat" },
  { slugs: ["rsa", "rsac"], label: "RSAC" },
  { slugs: ["troopers"], label: "TROOPERS" },
  { slugs: ["bsides"], label: "BSides" },
];

function foldConferenceName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugMatchesSTier(
  slug: string,
  spec: (typeof S_TIER_CONFERENCES)[number],
  kind: "exact" | "prefix",
): boolean {
  const value = slug.toLowerCase();
  if (kind === "exact") return spec.slugs.includes(value);
  return spec.slugs.some((alias) => value.startsWith(`${alias}-`));
}

function labelMatchesSTier(
  conference: { slug: string; label: string },
  spec: (typeof S_TIER_CONFERENCES)[number],
): boolean {
  const folded = foldConferenceName(conference.label);
  return (
    foldConferenceName(spec.label) === folded ||
    spec.slugs.some((alias) => foldConferenceName(alias) === folded)
  );
}

function pickSTier<T extends { slug: string; label: string }>(
  conferences: T[],
  spec: (typeof S_TIER_CONFERENCES)[number],
  used: Set<string>,
): T | undefined {
  const available = conferences.filter((conference) => !used.has(conference.slug));
  return (
    available.find((conference) => slugMatchesSTier(conference.slug, spec, "exact")) ??
    available.find((conference) => labelMatchesSTier(conference, spec)) ??
    available.find((conference) => slugMatchesSTier(conference.slug, spec, "prefix"))
  );
}

/** S-tier names for the hero, plus everyone else for the More control. */
export function splitHeroConferences<T extends { slug: string; label: string }>(
  conferences: T[],
): { featured: string[]; rest: T[] } {
  const used = new Set<string>();
  const featured: string[] = [];

  for (const spec of S_TIER_CONFERENCES) {
    const match = pickSTier(conferences, spec, used);
    if (match) {
      used.add(match.slug);
      featured.push(spec.label);
    }
  }

  return {
    featured,
    rest: conferences.filter((conference) => !used.has(conference.slug)),
  };
}

export function conferenceLabel(slug: string): string {
  return CONFERENCE_LABELS[slug] ?? slug.replace(/-/g, " ").toUpperCase();
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** "28 April–1 May 2025" -> "Apr 2025". The month the event opened, and its year. */
export function dateLabel(dates: string, year: number): string {
  const lower = dates.toLowerCase();
  const month = MONTHS.find((name) => lower.includes(name));
  if (!month) return String(year);
  const short = month.slice(0, 3);
  return `${short[0].toUpperCase()}${short.slice(1)} ${year}`;
}

const COUNTRIES = new Set(["usa", "us", "germany", "china", "uk", "canada", "france", "japan"]);

/**
 * Events store venues ("Caesars Forum, Flamingo, Harrah's, and Linq, Las Vegas"),
 * which are too long for a chip. Reduce to the city.
 */
export function locationLabel(location: string): string {
  if (/virtual|discord|twitch|\(vr\)/i.test(location)) return "Online";
  if (/las vegas/i.test(location)) return "Las Vegas";
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return location;
  const last = parts[parts.length - 1];
  if (parts.length > 1 && COUNTRIES.has(last.toLowerCase())) return parts[parts.length - 2];
  return last;
}

export function formatViews(count: number): string {
  const compact = (value: number, unit: string) =>
    `${value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "")}${unit}`;
  if (count >= 1_000_000) return compact(count / 1_000_000, "M");
  if (count >= 1_000) return compact(count / 1_000, "K");
  return String(count);
}

/** Easiest first; "unknown" sorts last wherever levels are listed. */
export const DIFFICULTIES: readonly Difficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
  "unknown",
];

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
  unknown: "Unknown",
};

/** Anything missing or unrecognised reads as "unknown". */
export function normalizeDifficulty(value: unknown): Difficulty {
  return DIFFICULTIES.includes(value as Difficulty) ? (value as Difficulty) : "unknown";
}

export function difficultyLabel(value: Difficulty): string {
  return DIFFICULTY_LABELS[value];
}
