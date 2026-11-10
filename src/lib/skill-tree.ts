/**
 * Skill tree model: layout, unlock rules and ranks. Pure — safe on server and client.
 *
 * A field (one track) has branches. Each branch is a horizontal lane; tiers
 * (beginner → expert) are columns. Within a branch a talk is unlocked by the
 * talks in the nearest lower tier of that branch, plus any `after` talks.
 * Talks with nothing below them are entry points and start unlocked.
 */
import type { Difficulty } from "./types";

export type SkillTalk = {
  id: string;
  youtubeId: string;
  slug: string;
  title: string;
  speakers: string[];
  /** Conference or event group, for a chip. */
  event: string;
  durationSeconds: number;
  difficulty: Difficulty;
  /** Own-words overview, or the card teaser. */
  teaser: string;
  /** youtubeIds of talks elsewhere in the field that also unlock this one. */
  after: string[];
};

export type SkillBranch = { name: string; talks: SkillTalk[] };

export type SkillField = {
  slug: string;
  name: string;
  blurb: string;
  track: string;
  rated: Record<Difficulty, number>;
  unrated: number;
  branches: SkillBranch[];
};

export type SkillTreeFile = { fields: SkillField[] };

export const TIERS: { level: Difficulty; numeral: string; name: string }[] = [
  { level: "beginner", numeral: "I", name: "Beginner" },
  { level: "intermediate", numeral: "II", name: "Intermediate" },
  { level: "advanced", numeral: "III", name: "Advanced" },
  { level: "expert", numeral: "IV", name: "Expert" },
];

export const TIER_INDEX: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

export const RANKS = [
  { name: "Operator", minSeconds: 0 },
  { name: "Specialist", minSeconds: 4 * 3600 },
  { name: "Elite", minSeconds: 10 * 3600 },
] as const;

export const LAYOUT = {
  cardW: 268,
  cardH: 92,
  gap: 16,
  lanePad: 26,
  laneGap: 14,
  top: 24,
  rootX: 36,
  rootSize: 168,
  hubX: 252,
  hubW: 214,
  hubH: 76,
  tierX: [540, 880, 1220, 1560],
} as const;

export type PlacedTalk = SkillTalk & {
  key: string;
  branchIndex: number;
  x: number;
  y: number;
  /** youtubeIds of the talks that unlock this one. Empty = entry point. */
  parents: string[];
};

export type PlacedBranch = {
  name: string;
  index: number;
  y: number;
  height: number;
  centerY: number;
  talks: PlacedTalk[];
};

export type FieldLayout = {
  width: number;
  height: number;
  rootY: number;
  branches: PlacedBranch[];
  talks: PlacedTalk[];
  byYoutubeId: Map<string, PlacedTalk>;
};

export function layoutField(field: SkillField): FieldLayout {
  const L = LAYOUT;
  const branches: PlacedBranch[] = [];
  const all: PlacedTalk[] = [];
  let y = L.top;

  field.branches.forEach((branch, branchIndex) => {
    const columns: SkillTalk[][] = [[], [], [], []];
    for (const talk of branch.talks) columns[TIER_INDEX[talk.difficulty]].push(talk);
    const rows = Math.max(1, ...columns.map((c) => c.length));
    const stack = (n: number) => n * L.cardH + Math.max(0, n - 1) * L.gap;
    const height = stack(rows) + L.lanePad * 2;

    const placed: PlacedTalk[] = [];
    columns.forEach((column, tier) => {
      const top = y + (height - stack(column.length)) / 2;
      column.forEach((talk, row) => {
        placed.push({
          ...talk,
          key: `${branchIndex}:${talk.youtubeId}`,
          branchIndex,
          x: L.tierX[tier],
          y: top + row * (L.cardH + L.gap),
          parents: [],
        });
      });
    });

    for (const talk of placed) {
      const tier = TIER_INDEX[talk.difficulty];
      const lower = placed.filter((p) => TIER_INDEX[p.difficulty] < tier);
      const nearest = Math.max(-1, ...lower.map((p) => TIER_INDEX[p.difficulty]));
      const own = lower.filter((p) => TIER_INDEX[p.difficulty] === nearest).map((p) => p.youtubeId);
      talk.parents = [...new Set([...own, ...talk.after])];
    }

    branches.push({ name: branch.name, index: branchIndex, y, height, centerY: y + height / 2, talks: placed });
    all.push(...placed);
    y += height + L.laneGap;
  });

  const height = Math.max(y + L.top, L.rootSize + L.top * 2);
  return {
    width: L.tierX[3] + L.cardW + 60,
    height,
    rootY: height / 2,
    branches,
    talks: all,
    byYoutubeId: new Map(all.map((t) => [t.youtubeId, t])),
  };
}

export type TalkStatus = "watched" | "ready" | "locked";

/** True when the saved-store id list contains this talk (any archive copy of the video). */
export function watchedIn(watched: ReadonlySet<string>, talk: Pick<SkillTalk, "id" | "youtubeId">): boolean {
  if (watched.has(talk.id)) return true;
  for (const id of watched) if (id.endsWith(`-${talk.youtubeId}`)) return true;
  return false;
}

export function talkStatus(
  talk: PlacedTalk,
  layout: FieldLayout,
  watched: ReadonlySet<string>,
): TalkStatus {
  if (watchedIn(watched, talk)) return "watched";
  if (talk.parents.length === 0) return "ready";
  return talk.parents.some((id) => {
    const parent = layout.byYoutubeId.get(id);
    return parent ? watchedIn(watched, parent) : false;
  })
    ? "ready"
    : "locked";
}

export type RankProgress = {
  rank: (typeof RANKS)[number];
  rankIndex: number;
  next: (typeof RANKS)[number] | null;
  watchedSeconds: number;
  watchedTalks: number;
  /** 0–1 along the whole ladder, for the bar. */
  ladder: number;
};

export function rankFor(layout: FieldLayout, watched: ReadonlySet<string>): RankProgress {
  const done = layout.talks.filter((t) => watchedIn(watched, t));
  const watchedSeconds = done.reduce((sum, t) => sum + t.durationSeconds, 0);
  let rankIndex = 0;
  RANKS.forEach((r, i) => {
    if (watchedSeconds >= r.minSeconds) rankIndex = i;
  });
  const top = RANKS[RANKS.length - 1].minSeconds;
  return {
    rank: RANKS[rankIndex],
    rankIndex,
    next: RANKS[rankIndex + 1] ?? null,
    watchedSeconds,
    watchedTalks: done.length,
    ladder: Math.min(1, watchedSeconds / top),
  };
}

/** "4h 26m" — always hours and minutes, for the stats box. */
export function hoursMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}
