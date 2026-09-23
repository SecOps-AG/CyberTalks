/**
 * Client-side loader for year-sharded talk index under /data/talk-index/.
 * Used by TalkBrowser (remoteIndex), SavedPageClient, and CommandPaletteProvider.
 */
import type { TalkIndexEntry } from "./types";

export async function fetchTalkIndexYears(): Promise<number[]> {
  const yearsRes = await fetch("/data/talk-index/years.json");
  if (!yearsRes.ok) {
    throw new Error(`Failed to load talk-index years (${yearsRes.status})`);
  }
  const years: number[] = await yearsRes.json();
  return years.slice().sort((a, b) => b - a);
}

export async function fetchTalkIndexYear(year: number): Promise<TalkIndexEntry[]> {
  const res = await fetch(`/data/talk-index/talks-${year}.json`);
  if (!res.ok) return [];
  return (await res.json()) as TalkIndexEntry[];
}

/**
 * Load every year shard. Newest year first so the UI can paint early via onChunk;
 * remaining years fetch in parallel and merge as each completes.
 */
export async function fetchTalkIndexShards(
  onChunk?: (talks: TalkIndexEntry[], meta: { year: number; loaded: number; total: number }) => void,
): Promise<TalkIndexEntry[]> {
  const years = await fetchTalkIndexYears();
  if (years.length === 0) return [];

  const byYear = new Map<number, TalkIndexEntry[]>();
  let loaded = 0;

  const snapshot = (): TalkIndexEntry[] => {
    const out: TalkIndexEntry[] = [];
    for (const year of years) {
      const chunk = byYear.get(year);
      if (chunk) out.push(...chunk);
    }
    return out;
  };

  const apply = (year: number, entries: TalkIndexEntry[]) => {
    byYear.set(year, entries);
    loaded += 1;
    onChunk?.(snapshot(), { year, loaded, total: years.length });
  };

  // Newest year first — homepage becomes usable ASAP.
  apply(years[0], await fetchTalkIndexYear(years[0]));

  await Promise.all(
    years.slice(1).map(async (year) => {
      apply(year, await fetchTalkIndexYear(year));
    }),
  );

  return snapshot();
}
