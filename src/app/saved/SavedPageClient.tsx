"use client";

import { useEffect, useRef, useState } from "react";
import { TalkCard } from "@/components/TalkCard";
import { SectionHeading } from "@/components/SectionHeading";
import {
  getSavedState,
  exportJson,
  importJson,
  type SavedState,
} from "@/lib/saved";
import type { TalkIndexEntry } from "@/lib/types";

export function SavedPageClient({ allTalks }: { allTalks: TalkIndexEntry[] }) {
  const [state, setState] = useState<SavedState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setState(getSavedState());
    const handler = () => setState(getSavedState());
    window.addEventListener("saved-changed", handler);
    return () => window.removeEventListener("saved-changed", handler);
  }, []);

  if (state === null) {
    return <p className="text-sm text-mint/40 py-12 text-center">Loading…</p>;
  }

  const savedTalks = allTalks.filter((t) => state.saved.includes(t.id));
  const watchedIds = new Set(state.watched);

  function handleExport() {
    const json = exportJson(state!);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "defcon-saved.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = importJson(text);
      if (result) {
        setState(result);
        setImportError(null);
      } else {
        setImportError("Invalid file — expected {saved: string[], watched: string[]}");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[0.05em] text-acid">
            Saved Talks
          </h1>
          <p className="mt-1 text-sm text-mint/50">
            {savedTalks.length === 0
              ? "Bookmark talks with the ★ button on any card or talk page."
              : `${savedTalks.length} saved · ${state.watched.length} watched`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleExport} className="chip text-[11px]">
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="chip text-[11px]"
          >
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            className="sr-only"
          />
        </div>
      </div>

      {importError ? (
        <p className="text-sm text-warn">{importError}</p>
      ) : null}

      {savedTalks.length === 0 ? (
        <div className="panel px-6 py-16 text-center">
          <p className="text-sm uppercase tracking-[0.16em] text-mint/40">No saved talks yet.</p>
        </div>
      ) : (
        <>
          <SectionHeading title={`${savedTalks.length} saved`} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {savedTalks.map((talk) => (
              <div key={talk.id} className="relative">
                {watchedIds.has(talk.id) ? (
                  <span
                    className="absolute left-2 top-2 z-10 rounded-sm border border-mint/20 bg-void/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-mint/50"
                    title="Watched"
                  >
                    watched
                  </span>
                ) : null}
                <TalkCard talk={talk} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
