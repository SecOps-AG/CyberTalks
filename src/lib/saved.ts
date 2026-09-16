/**
 * Client-side saved/watched store using localStorage.
 * Pure functions — no React, no hooks, safe to import from client components.
 */

export type SavedState = {
  saved: string[]; // talk IDs
  watched: string[]; // talk IDs
};

const KEY = "defcon-talks:saved-v1";

function read(): SavedState {
  if (typeof window === "undefined") return { saved: [], watched: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { saved: [], watched: [] };
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return {
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      watched: Array.isArray(parsed.watched) ? parsed.watched : [],
    };
  } catch {
    return { saved: [], watched: [] };
  }
}

function write(state: SavedState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
  // Notify same-tab listeners via a custom event
  window.dispatchEvent(new CustomEvent("saved-changed"));
}

export function getSavedState(): SavedState {
  return read();
}

export function toggleSaved(id: string): SavedState {
  const state = read();
  const idx = state.saved.indexOf(id);
  const next: SavedState = {
    ...state,
    saved: idx >= 0 ? state.saved.filter((s) => s !== id) : [...state.saved, id],
  };
  write(next);
  return next;
}

export function markWatched(id: string): SavedState {
  const state = read();
  const next: SavedState = {
    ...state,
    watched: state.watched.includes(id) ? state.watched : [...state.watched, id],
  };
  write(next);
  return next;
}

export function isSaved(id: string, state: SavedState): boolean {
  return state.saved.includes(id);
}

export function isWatched(id: string, state: SavedState): boolean {
  return state.watched.includes(id);
}

export function exportJson(state: SavedState): string {
  return JSON.stringify(state, null, 2);
}

export function importJson(json: string): SavedState | null {
  try {
    const parsed = JSON.parse(json) as Partial<SavedState>;
    if (!Array.isArray(parsed.saved) || !Array.isArray(parsed.watched)) return null;
    const merged = read();
    const next: SavedState = {
      saved: [...new Set([...merged.saved, ...parsed.saved])],
      watched: [...new Set([...merged.watched, ...parsed.watched])],
    };
    write(next);
    return next;
  } catch {
    return null;
  }
}
