/**
 * Client-side loader for year- and conference-sharded talk index under /data/talk-index/.
 * Used by TalkBrowser (remoteIndex), SavedPageClient, and CommandPaletteProvider.
 */
import type { TalkIndexEntry } from "./types";

export type TalkIndexChunkMeta = {
  file: string;
  conferences: string[];
  talks: number;
  bytes: number;
  priority: number;
};

export type TalkIndexManifest = {
  version: 1;
  years: number[];
  chunks: Record<string, TalkIndexChunkMeta[]>;
};

export type FetchTalkIndexChunkMeta = {
  file: string;
  year: number;
  loaded: number;
  total: number;
  complete: boolean;
};

export type FetchTalkIndexHints = {
  /** Only load chunks for these years. Omit or empty = all years. */
  years?: number[];
  /** Only load chunks covering at least one of these conference slugs. */
  conferences?: string[];
  /** Chunk files already merged into the current catalog (skip re-fetch). */
  loadedFiles?: ReadonlySet<string> | readonly string[];
  onChunk?: (talks: TalkIndexEntry[], meta: FetchTalkIndexChunkMeta) => void;
  signal?: AbortSignal;
};

const INDEX_BASE = "/data/talk-index";

function asLoadedSet(
  loadedFiles?: ReadonlySet<string> | readonly string[],
): Set<string> {
  if (!loadedFiles) return new Set();
  if (loadedFiles instanceof Set) return new Set(loadedFiles);
  return new Set(loadedFiles);
}

export async function fetchTalkIndexManifest(): Promise<TalkIndexManifest> {
  const manifestRes = await fetch(`${INDEX_BASE}/manifest.json`);
  if (manifestRes.ok) {
    return (await manifestRes.json()) as TalkIndexManifest;
  }

  // Legacy fallback: years.json + one file per year.
  const yearsRes = await fetch(`${INDEX_BASE}/years.json`);
  if (!yearsRes.ok) {
    throw new Error(`Failed to load talk-index manifest (${manifestRes.status})`);
  }
  const years: number[] = await yearsRes.json();
  const chunks: Record<string, TalkIndexChunkMeta[]> = {};
  for (const year of years) {
    chunks[String(year)] = [
      {
        file: `talks-${year}.json`,
        conferences: [],
        talks: 0,
        bytes: 0,
        priority: 0,
      },
    ];
  }
  return { version: 1, years, chunks };
}

export async function fetchTalkIndexYears(): Promise<number[]> {
  const manifest = await fetchTalkIndexManifest();
  return manifest.years.slice().sort((a, b) => b - a);
}

export async function fetchTalkIndexChunk(file: string): Promise<TalkIndexEntry[]> {
  const res = await fetch(`${INDEX_BASE}/${file}`);
  if (!res.ok) return [];
  return (await res.json()) as TalkIndexEntry[];
}

/** @deprecated Prefer fetchTalkIndexChunk — kept for callers keyed by year only. */
export async function fetchTalkIndexYear(year: number): Promise<TalkIndexEntry[]> {
  return fetchTalkIndexChunk(`talks-${year}.json`);
}

type ResolvedChunk = TalkIndexChunkMeta & { year: number };

function resolveChunks(
  manifest: TalkIndexManifest,
  hints: FetchTalkIndexHints,
): ResolvedChunk[] {
  const loaded = asLoadedSet(hints.loadedFiles);
  const yearFilter =
    hints.years && hints.years.length > 0 ? new Set(hints.years) : null;
  const confFilter =
    hints.conferences && hints.conferences.length > 0
      ? new Set(hints.conferences)
      : null;

  const sortedYears = manifest.years.slice().sort((a, b) => b - a);
  const out: ResolvedChunk[] = [];

  for (const year of sortedYears) {
    if (yearFilter && !yearFilter.has(year)) continue;
    const yearChunks = manifest.chunks[String(year)] ?? [];
    for (const chunk of yearChunks) {
      if (loaded.has(chunk.file)) continue;
      if (confFilter) {
        const matches = chunk.conferences.some((conf) => confFilter.has(conf));
        if (!matches) continue;
      }
      out.push({ ...chunk, year });
    }
  }

  out.sort((a, b) => b.year - a.year || a.priority - b.priority);
  return out;
}

function mergeTalkLists(
  existing: TalkIndexEntry[],
  additions: TalkIndexEntry[],
): TalkIndexEntry[] {
  if (existing.length === 0) return additions;
  if (additions.length === 0) return existing;

  const seen = new Set(existing.map((talk) => talk.id));
  const merged = existing.slice();
  for (const talk of additions) {
    if (seen.has(talk.id)) continue;
    seen.add(talk.id);
    merged.push(talk);
  }
  return merged;
}

/**
 * Load talk-index chunks with optional year/conference hints.
 *
 * - Unfiltered: newest year first, highest-priority chunk within each year first,
 *   then remaining chunks in parallel.
 * - Filtered: only matching year/conference chunks are requested.
 * - `loadedFiles`: skip chunks already merged (for incremental filter changes).
 * - `onChunk` receives the running merged catalog after each chunk lands.
 */
export async function fetchTalkIndexShards(
  hintsOrOnChunk?:
    | FetchTalkIndexHints
    | ((
        talks: TalkIndexEntry[],
        meta: FetchTalkIndexChunkMeta,
      ) => void),
): Promise<TalkIndexEntry[]> {
  const hints: FetchTalkIndexHints =
    typeof hintsOrOnChunk === "function"
      ? { onChunk: hintsOrOnChunk }
      : (hintsOrOnChunk ?? {});

  const manifest = await fetchTalkIndexManifest();
  const pending = resolveChunks(manifest, hints);
  const total = pending.length;

  if (total === 0) {
    hints.onChunk?.([], {
      file: "",
      year: 0,
      loaded: 0,
      total: 0,
      complete: true,
    });
    return [];
  }

  const byFile = new Map<string, TalkIndexEntry[]>();
  let loaded = 0;

  const emit = (file: string, year: number) => {
    const snapshot: TalkIndexEntry[] = [];
    for (const chunk of pending) {
      const entries = byFile.get(chunk.file);
      if (entries) snapshot.push(...entries);
    }
    hints.onChunk?.(snapshot, {
      file,
      year,
      loaded,
      total,
      complete: loaded >= total,
    });
    return snapshot;
  };

  const loadOne = async (chunk: ResolvedChunk) => {
    if (hints.signal?.aborted) return;
    const entries = await fetchTalkIndexChunk(chunk.file);
    if (hints.signal?.aborted) return;
    byFile.set(chunk.file, entries);
    loaded += 1;
    emit(chunk.file, chunk.year);
  };

  await loadOne(pending[0]);

  if (pending.length > 1) {
    await Promise.all(pending.slice(1).map((chunk) => loadOne(chunk)));
  }

  const final: TalkIndexEntry[] = [];
  for (const chunk of pending) {
    const entries = byFile.get(chunk.file);
    if (entries) final.push(...entries);
  }
  return final;
}

/**
 * Incrementally fetch any chunks not yet loaded, merging into `existingTalks`.
 * Returns the merged catalog and the set of newly loaded chunk files.
 */
export async function fetchAdditionalTalkIndexChunks(
  hints: FetchTalkIndexHints & { existingTalks?: TalkIndexEntry[] },
): Promise<{ talks: TalkIndexEntry[]; loadedFiles: string[] }> {
  const manifest = await fetchTalkIndexManifest();
  const pending = resolveChunks(manifest, hints);
  const loadedFiles: string[] = [];
  let talks = hints.existingTalks ?? [];

  if (pending.length === 0) {
    hints.onChunk?.(talks, {
      file: "",
      year: 0,
      loaded: 0,
      total: 0,
      complete: true,
    });
    return { talks, loadedFiles };
  }

  const byFile = new Map<string, TalkIndexEntry[]>();
  let loaded = 0;
  const total = pending.length;

  const emit = (file: string, year: number) => {
    const additions: TalkIndexEntry[] = [];
    for (const chunk of pending.slice(0, loaded)) {
      const entries = byFile.get(chunk.file);
      if (entries) additions.push(...entries);
    }
    talks = mergeTalkLists(talks, additions);
    hints.onChunk?.(talks, {
      file,
      year,
      loaded,
      total,
      complete: loaded >= total,
    });
  };

  const loadOne = async (chunk: ResolvedChunk) => {
    if (hints.signal?.aborted) return;
    const entries = await fetchTalkIndexChunk(chunk.file);
    if (hints.signal?.aborted) return;
    byFile.set(chunk.file, entries);
    loadedFiles.push(chunk.file);
    loaded += 1;
    emit(chunk.file, chunk.year);
  };

  await loadOne(pending[0]);
  if (pending.length > 1) {
    await Promise.all(pending.slice(1).map((chunk) => loadOne(chunk)));
  }

  for (const chunk of pending) {
    const entries = byFile.get(chunk.file);
    if (entries) talks = mergeTalkLists(talks, entries);
  }

  return { talks, loadedFiles };
}
