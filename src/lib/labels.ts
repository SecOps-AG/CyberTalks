/**
 * Short display labels for card chips. Pure — safe on server and client.
 */

/** Display names for the `conference` family slug stored on each village file. */
const CONFERENCE_LABELS: Record<string, string> = {
  defcon: "DEF CON",
  "black-hat": "Black Hat",
  rsa: "RSAC",
  troopers: "TROOPERS",
};

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
