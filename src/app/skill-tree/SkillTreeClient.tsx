"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getSavedState, markWatched, unmarkWatched } from "@/lib/saved";
import { thumbnailSrc } from "@/lib/materials";
import { formatDuration } from "@/lib/search";
import {
  branchLeaves,
  stretchedWidth,
  hoursMinutes,
  LAYOUT,
  layoutField,
  rankFor,
  RANKS,
  talkStatus,
  TIER_INDEX,
  TIERS,
  type FieldLayout,
  type PlacedTalk,
  type SkillField,
  type SkillTreeFile,
  type TalkStatus,
} from "@/lib/skill-tree";
import { TalkIcon } from "./icons";
import styles from "./skill-tree.module.css";

type View = { x: number; y: number; k: number };

const TIER_CLASS = [styles.t1, styles.t2, styles.t3, styles.t4];
const FIELD_KEY = "cybertalks:skill-tree-field";
/** Tier header strip height inside the canvas, in screen pixels. */
const STRIP = 36;
const PAD = 16;
/** Smallest zoom the first screen may use to fit the whole tree. */
const MIN_FIT_K = 0.55;
/** Branch gate (small diamond) half-size, world pixels. */
const GATE_R = 9;
/** Width of the faint band behind each tier column, world pixels. */
const COLUMN_W = 130;
const MAX_K = 1.6;

/** Emblem icon for each field. */
const FIELD_ICON: Record<string, string> = {
  "red-team": "target",
  "blue-team": "shield",
  appsec: "code",
  malware: "skull",
  cloud: "cloud",
  "ai-security": "brain",
  "threat-intel": "flag-world",
  osint: "eye",
  "social-engineering": "mask",
  hardware: "chip",
  wireless: "radio",
  "ics-ot": "factory",
  mobile: "phone",
  "supply-chain": "package",
  privacy: "eye-off",
};

/** A branch shows the icon most of its talks share. */
function branchIcon(b: { talks: { icon?: string }[] }): string | undefined {
  const count = new Map<string, number>();
  for (const t of b.talks) if (t.icon) count.set(t.icon, (count.get(t.icon) ?? 0) + 1);
  return [...count].sort((x, y) => y[1] - x[1])[0]?.[0];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Circuit-style link: flat, a short diagonal in the middle, flat again. */
function elbow(x1: number, y1: number, x2: number, y2: number) {
  const dy = y2 - y1;
  if (Math.abs(dy) < 0.5) return `M${x1},${y1} H${x2}`;
  const mid = (x1 + x2) / 2;
  const run = Math.min(Math.abs(dy), (x2 - x1) * 0.6);
  return `M${x1},${y1} H${mid - run / 2} L${mid + run / 2},${y2} H${x2}`;
}

export function SkillTreeClient({ data }: { data: SkillTreeFile }) {
  const [fieldSlug, setFieldSlug] = useState(data.fields[0].slug);
  const [watched, setWatched] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);

  const field: SkillField = data.fields.find((f) => f.slug === fieldSlug) ?? data.fields[0];
  const layout = useMemo(() => layoutField(field), [field]);
  const status = useCallback((t: PlacedTalk): TalkStatus => talkStatus(t, layout, watched), [layout, watched]);
  const rank = useMemo(() => rankFor(layout, watched), [layout, watched]);

  // Watched state is the site-wide saved store, so talk pages count too.
  useEffect(() => {
    const load = () => setWatched(new Set(getSavedState().watched));
    load();
    window.addEventListener("saved-changed", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("saved-changed", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  // Field from the URL hash, else the last one viewed.
  useEffect(() => {
    const pick = () => {
      const fromHash = window.location.hash.slice(1);
      if (data.fields.some((f) => f.slug === fromHash)) return fromHash;
      try {
        const saved = window.localStorage.getItem(FIELD_KEY);
        if (saved && data.fields.some((f) => f.slug === saved)) return saved;
      } catch {
        // Storage blocked.
      }
      return null;
    };
    const apply = () => {
      const slug = pick();
      if (slug) setFieldSlug(slug);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [data.fields]);

  function chooseField(slug: string) {
    setFieldSlug(slug);
    setSelected(null);
    try {
      window.localStorage.setItem(FIELD_KEY, slug);
    } catch {
      // Storage blocked; the hash still records it.
    }
    history.replaceState(null, "", `#${slug}`);
  }

  const nextUp = useMemo(() => {
    const ready = layout.talks.filter((t) => status(t) === "ready");
    ready.sort((a, b) => TIER_INDEX[a.difficulty] - TIER_INDEX[b.difficulty] || a.branchIndex - b.branchIndex);
    return ready[0] ?? null;
  }, [layout, status]);

  function toggleWatched(t: PlacedTalk) {
    if (status(t) === "watched") {
      for (const id of watched) if (id === t.id || id.endsWith(`-${t.youtubeId}`)) unmarkWatched(id);
    } else {
      markWatched(t.id);
    }
  }

  const fieldProgress = (f: SkillField) => {
    let done = 0;
    let total = 0;
    for (const b of f.branches)
      for (const t of b.talks) {
        total += 1;
        if (watched.has(t.id) || [...watched].some((w) => w.endsWith(`-${t.youtubeId}`))) done += 1;
      }
    return { done, total };
  };

  const top = RANKS[RANKS.length - 1].minSeconds;

  const fieldNav = (
    <div className={styles.fields} role="tablist" aria-label="Field">
      {data.fields.map((f) => {
        const p = fieldProgress(f);
        return (
          <button
            key={f.slug}
            type="button"
            role="tab"
            aria-selected={f.slug === field.slug}
            className={styles.fieldTab}
            onClick={() => chooseField(f.slug)}
            title={`${p.done} of ${p.total} watched`}
            style={{ "--p": `${p.total ? (p.done / p.total) * 100 : 0}%` } as React.CSSProperties}
          >
            {f.name}
            <span className={styles.fieldCount}>
              {p.done}/{p.total}
            </span>
          </button>
        );
      })}
    </div>
  );

  const shared = {
    field,
    layout,
    status,
    selected,
    setSelected,
    onToggle: toggleWatched,
    onWatch: (t: PlacedTalk) => markWatched(t.id),
  };

  return (
    <div className={styles.page}>
      <section className={`panel ${styles.head}`}>
        <div className={styles.headText}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Skill Tree</h1>
            <p className={styles.lede}>
              An experiment: talks from the archive, sorted by difficulty and topic into suggested paths. Treat it as
              a loose guide to what to watch next, not a course.
            </p>
          </div>
        </div>

        <div className={styles.stats} aria-live="polite">
          <div className={styles.badge} aria-hidden="true">
            {["I", "II", "III"][rank.rankIndex]}
          </div>
          <div className={styles.rankBlock}>
            <p className={styles.statLabel}>{field.name} rank</p>
            <p className={styles.rankName}>{rank.rank.name}</p>
            <div
              className={styles.rankBar}
              role="progressbar"
              aria-label={`Progress to ${RANKS[RANKS.length - 1].name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(rank.ladder * 100)}
              title={RANKS.map((r) => r.name).join(" → ")}
            >
              <i style={{ width: `${rank.ladder * 100}%` }} />
              {RANKS.slice(1, -1).map((r) => (
                <u key={r.name} style={{ left: `${(r.minSeconds / top) * 100}%` }} />
              ))}
            </div>
            <p className={styles.toNext}>
              {rank.next
                ? `${hoursMinutes(rank.next.minSeconds - rank.watchedSeconds)} more to ${rank.next.name}`
                : "Top rank in this field"}
            </p>
          </div>
          <dl className={styles.nums}>
            <div>
              <dt className={styles.statLabel}>Watched</dt>
              <dd>{hoursMinutes(rank.watchedSeconds)}</dd>
            </div>
            <div>
              <dt className={styles.statLabel}>Talks</dt>
              <dd>
                {rank.watchedTalks}/{layout.talks.length}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            className={styles.nextBtn}
            disabled={!nextUp}
            onClick={() => nextUp && setSelected(nextUp.youtubeId)}
          >
            Next talk to watch →
          </button>
        </div>
      </section>

      <div className={styles.desktopOnly}>
        <TreeCanvas {...shared} rail={fieldNav} />
      </div>
      <div className={styles.mobileOnly}>
        {fieldNav}
        <TreeList {...shared} />
      </div>

      <p className={styles.footnote}>
        Only talks with a difficulty rating can be placed, so the tree is a small sample.{" "}
        <a href={`/tracks/${field.track}`} className="link">
          Browse every {field.name} talk
        </a>
        .
      </p>
    </div>
  );
}

type SharedProps = {
  field: SkillField;
  layout: FieldLayout;
  status: (t: PlacedTalk) => TalkStatus;
  selected: string | null;
  setSelected: (id: string | null) => void;
  onToggle: (t: PlacedTalk) => void;
  onWatch: (t: PlacedTalk) => void;
};

/* ------------------------------------------------------------------ */
/* Desktop: the whole tree fitted to the screen, with pan and zoom.    */
/* ------------------------------------------------------------------ */

function TreeCanvas({
  field,
  layout: base,
  status,
  selected,
  setSelected,
  onToggle,
  onWatch,
  rail,
}: SharedProps & { rail: React.ReactNode }) {
  const L = LAYOUT;
  const viewportRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(640);
  const [fitK, setFitK] = useState(1);
  const [view, setView] = useState<View>({ x: PAD, y: STRIP, k: 1 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(false);
  const [query, setQuery] = useState("");
  // Spread the tiers out so the tree fills the width the screen has.
  const [stretch, setStretch] = useState(1);
  const layout = useMemo(() => (stretch === 1 ? base : layoutField(field, stretch)), [base, field, stretch]);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Size the canvas so the whole tree fits the rest of the screen.
  // If it can't fit even at the smallest zoom, the canvas grows and the page scrolls.
  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el || el.offsetParent === null) return;
    const w = el.clientWidth;
    const topOnPage = el.getBoundingClientRect().top + window.scrollY;
    const below = (hintRef.current?.offsetHeight ?? 44) + 12;
    const room = Math.max(420, window.innerHeight - topOnPage - below);
    const kHeight = clamp(Math.min((room - STRIP - PAD * 2) / base.height, 1.3), MIN_FIT_K, MAX_K);
    const L0 = LAYOUT;
    const wantW = (w - PAD * 2) / kHeight;
    const s = clamp((wantW - L0.gateX - (L0.width - L0.capX)) / (L0.capX - L0.gateX), 1, 1.9);
    const worldW = stretchedWidth(s);
    const k = clamp(Math.min((w - PAD * 2) / worldW, kHeight), MIN_FIT_K, MAX_K);
    const h = Math.round(base.height * k + STRIP + PAD * 2);
    setStretch(Math.round(s * 100) / 100);
    setWidth(w);
    setHeight(h);
    setFitK(k);
    setView({
      k,
      x: (w - stretchedWidth(Math.round(s * 100) / 100) * k) / 2,
      y: STRIP + (h - STRIP - base.height * k) / 2,
    });
  }, [base]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let last = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== last) {
        last = el.clientWidth;
        measure();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const fitted = Math.abs(view.k - fitK) < 0.01 && Math.abs(view.x - (width - layout.width * fitK) / 2) < 2;

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const k = clamp(v.k * factor, 0.35, MAX_K);
      return {
        k,
        x: cx - ((cx - v.x) * k) / v.k,
        y: cy - ((cy - v.y) * k) / v.k,
      };
    });
  }, []);

  // ---- pan / pinch ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);
  const pinch = useRef<{ d: number; k: number } | null>(null);
  const suppressClick = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-overlay]")) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        k: viewRef.current.k,
      };
      drag.current = null;
      return;
    }
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      vx: viewRef.current.x,
      vy: viewRef.current.y,
      moved: false,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const rect = viewportRef.current!.getBoundingClientRect();
      const k = clamp(pinch.current.k * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d), 0.35, MAX_K);
      zoomAt(k / viewRef.current.k, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      suppressClick.current = true;
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) {
      d.moved = true;
      setHovered(null);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  }

  function onPointerUp(e: React.PointerEvent) {
    const wasClick = drag.current && !drag.current.moved;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (drag.current?.moved || suppressClick.current) {
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
    }
    // A plain click on empty canvas closes the talk card.
    if (wasClick && !(e.target as HTMLElement).closest("button,a,[data-overlay]")) setSelected(null);
    drag.current = null;
  }

  // Ctrl/⌘ + wheel (and trackpad pinch) zooms; a plain wheel scrolls the page
  // when the tree is fitted, and pans once zoomed in.
  const fittedRef = useRef(fitted);
  fittedRef.current = fitted;
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[data-overlay]")) return;
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
        return;
      }
      if (fittedRef.current) return;
      e.preventDefault();
      setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).closest("input")) return;
    const step = 80;
    const cx = width / 2;
    const cy = height / 2;
    switch (e.key) {
      case "ArrowLeft":
        setView((v) => ({ ...v, x: v.x + step }));
        break;
      case "ArrowRight":
        setView((v) => ({ ...v, x: v.x - step }));
        break;
      case "ArrowUp":
        setView((v) => ({ ...v, y: v.y + step }));
        break;
      case "ArrowDown":
        setView((v) => ({ ...v, y: v.y - step }));
        break;
      case "+":
      case "=":
        zoomAt(1.2, cx, cy);
        break;
      case "-":
        zoomAt(1 / 1.2, cx, cy);
        break;
      case "0":
        measure();
        break;
      case "Escape":
        setSelected(null);
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  function focusBranch(index: number) {
    if (suppressClick.current) return;
    const b = layout.branches[index];
    const x0 = L.gateX - 30;
    const x1 = layout.width;
    const k = clamp(Math.min(1.5, (height - STRIP - PAD * 2) / b.height, (width - PAD * 2) / (x1 - x0)), fitK, MAX_K);
    setSelected(null);
    setView({
      k,
      x: (width - (x1 - x0) * k) / 2 - x0 * k,
      y: STRIP + (height - STRIP) / 2 - b.centerY * k,
    });
  }

  // ---- search ----
  const q = query.trim().toLowerCase();
  const matches = (t: PlacedTalk) =>
    !q || t.title.toLowerCase().includes(q) || t.speakers.some((s) => s.toLowerCase().includes(q));

  // ---- edges ----
  type Edge = { key: string; d: string; cls: string };
  const edges: Edge[] = [];
  const lit = (done: boolean, open: boolean) => (done ? styles.edgeDone : open ? styles.edgeOpen : styles.edgeLocked);
  const firstY = layout.branches[0]?.centerY ?? layout.rootY;
  const lastY = layout.branches[layout.branches.length - 1]?.centerY ?? layout.rootY;
  edges.push({
    key: "root",
    d: `M${L.rootX + L.rootR},${layout.rootY} H${L.trunkX}`,
    cls: styles.edgeOpen,
  });
  edges.push({
    key: "trunk",
    d: `M${L.trunkX},${Math.min(firstY, layout.rootY)} V${Math.max(lastY, layout.rootY)}`,
    cls: styles.edgeOpen,
  });
  for (const b of layout.branches) {
    const anyDone = b.talks.some((t) => status(t) === "watched");
    edges.push({
      key: `gate-${b.index}`,
      d: `M${L.trunkX},${b.centerY} H${L.gateX - GATE_R}`,
      cls: lit(anyDone, true),
    });

    // Group the branch by tier; each step between two tiers forks and merges
    // through one junction on the branch's center line, so links never cross.
    const byTier = TIERS.map((_, i) => b.talks.filter((t) => TIER_INDEX[t.difficulty] === i)).filter((g) => g.length);
    byTier.forEach((group, gi) => {
      const prev = gi > 0 ? byTier[gi - 1] : null;
      if (!prev) {
        for (const t of group) {
          const st = status(t);
          edges.push({
            key: `entry-${t.key}`,
            d: elbow(L.gateX + GATE_R, b.centerY, t.x - t.r, t.y),
            cls: `${lit(st === "watched", st !== "locked")} ${selected === t.youtubeId ? styles.edgeFocus : ""}`,
          });
        }
        return;
      }
      const hubX = (layout.tierX[TIER_INDEX[prev[0].difficulty]] + layout.tierX[TIER_INDEX[group[0].difficulty]]) / 2;
      const prevDone = prev.some((p) => status(p) === "watched");
      for (const p of prev) {
        edges.push({
          key: `in-${p.key}`,
          d: elbow(p.x + p.r, p.y, hubX, b.centerY),
          cls: `${lit(status(p) === "watched", false)} ${selected === p.youtubeId ? styles.edgeFocus : ""}`,
        });
      }
      for (const t of group) {
        edges.push({
          key: `out-${t.key}`,
          d: elbow(hubX, b.centerY, t.x - t.r, t.y),
          cls: `${lit(prevDone && status(t) === "watched", prevDone)} ${selected === t.youtubeId ? styles.edgeFocus : ""}`,
        });
      }
    });

    // The run to the capstone lights up only once the whole branch is watched.
    const leaves = branchLeaves(b);
    const capHub = layout.tierX[TIER_INDEX[leaves[0].difficulty]] + 120;
    const branchDone = b.talks.every((t) => status(t) === "watched");
    for (const t of leaves) {
      edges.push({
        key: `cap-${t.key}`,
        d: elbow(t.x + t.r, t.y, capHub, b.centerY),
        cls: lit(branchDone, false),
      });
    }
    edges.push({
      key: `cap-${b.index}`,
      d: `M${capHub},${b.centerY} H${layout.capX - L.capR}`,
      cls: lit(branchDone, false),
    });
  }
  // Cross-branch prerequisites ("after" links) draw as dashed links.
  for (const t of layout.talks) {
    for (const pid of t.after) {
      const p = layout.byYoutubeId.get(pid);
      if (!p) continue;
      const parentDone = status(p) === "watched";
      const f = selected === pid || selected === t.youtubeId ? styles.edgeFocus : "";
      edges.push({
        key: `${pid}->${t.key}`,
        d: elbow(p.x + p.r, p.y, t.x - t.r, t.y),
        cls: `${lit(parentDone && status(t) === "watched", parentDone)} ${styles.edgeCross} ${f}`,
      });
    }
  }
  // Lit edges draw last so they sit on top of locked ones.
  const rankEdge = (e: Edge) => (e.cls.includes(styles.edgeDone) ? 2 : e.cls.includes(styles.edgeOpen) ? 1 : 0);
  edges.sort((a, b) => rankEdge(a) - rankEdge(b));

  const selectedTalk = selected ? (layout.byYoutubeId.get(selected) ?? null) : null;
  const hoveredTalk = hovered && hovered !== selected ? (layout.byYoutubeId.get(hovered) ?? null) : null;

  // ---- talk card placement, next to its node ----
  const popRef = useRef<HTMLDivElement>(null);
  const [popTop, setPopTop] = useState(0);
  const POP_W = 340;
  let popLeft = 0;
  let anchorTop = 0;
  if (selectedTalk) {
    const right = view.x + (selectedTalk.x + selectedTalk.r) * view.k + 16;
    const left = view.x + (selectedTalk.x - selectedTalk.r) * view.k - 16 - POP_W;
    popLeft = right + POP_W <= width - 8 ? right : Math.max(8, left);
    anchorTop = view.y + (selectedTalk.y - selectedTalk.r) * view.k;
  }
  useLayoutEffect(() => {
    if (!selectedTalk || !popRef.current) return;
    const h = popRef.current.offsetHeight;
    setPopTop(clamp(anchorTop - 24, 8, Math.max(8, height - h - 8)));
  }, [selectedTalk, anchorTop, height]);

  // Keep the selected node on screen (e.g. after "Next talk").
  useEffect(() => {
    if (!selectedTalk || width === 0) return;
    const v = viewRef.current;
    const x0 = v.x + (selectedTalk.x - selectedTalk.r) * v.k;
    const y0 = v.y + (selectedTalk.y - selectedTalk.r) * v.k;
    const x1 = v.x + (selectedTalk.x + selectedTalk.r) * v.k;
    const y1 = v.y + (selectedTalk.y + selectedTalk.r) * v.k;
    if (x0 >= 0 && x1 <= width && y0 >= STRIP && y1 <= height) {
      if (viewportRef.current) {
        const r = viewportRef.current.getBoundingClientRect();
        if (r.top < 0 || r.top + y1 > window.innerHeight) {
          window.scrollTo({
            top: window.scrollY + r.top + y0 - window.innerHeight / 2,
            behavior: "smooth",
          });
        }
      }
      return;
    }
    setView({
      k: v.k,
      x: width / 2 - selectedTalk.x * v.k,
      y: (height + STRIP) / 2 - selectedTalk.y * v.k,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTalk?.youtubeId]);

  // ---- minimap (only once zoomed or panned away from the fitted view) ----
  const MINI_W = 190;
  const miniH = (layout.height / layout.width) * MINI_W;
  const miniDrag = useRef(false);
  function miniMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const wx = ((e.clientX - rect.left) / rect.width) * layout.width;
    const wy = ((e.clientY - rect.top) / rect.height) * layout.height;
    setView((v) => ({
      ...v,
      x: width / 2 - wx * v.k,
      y: (height + STRIP) / 2 - wy * v.k,
    }));
  }

  const statusWord = (st: TalkStatus) => (st === "watched" ? "Watched" : st === "ready" ? "Ready to watch" : "Locked");

  return (
    <section className={styles.board} aria-label={`${field.name} skill tree`}>
      <div className={styles.fieldBar}>{rail}</div>
      <div className={styles.stage}>
        <div
          ref={viewportRef}
          className={styles.viewport}
          style={{ height }}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          data-fitted={fitted}
          data-searching={q ? "true" : undefined}
        >
          <div
            className={styles.world}
            style={
              {
                width: layout.width,
                height: layout.height,
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
                "--k": view.k,
              } as React.CSSProperties
            }
          >
            {TIERS.map((tier, i) => (
              <div
                key={tier.level}
                className={`${styles.column} ${TIER_CLASS[i]}`}
                style={{
                  left: layout.tierX[i] - COLUMN_W / 2,
                  width: COLUMN_W,
                  height: layout.height,
                }}
              />
            ))}

            <svg className={styles.edges} width={layout.width} height={layout.height} aria-hidden="true">
              {edges.map((e) => (
                <path key={e.key} d={e.d} className={`${styles.edge} ${e.cls}`} />
              ))}
            </svg>

            {/* field emblem */}
            <div
              className={styles.root}
              style={{
                left: L.rootX - L.rootR,
                top: layout.rootY - L.rootR,
                width: L.rootR * 2,
                height: L.rootR * 2,
              }}
              aria-hidden="true"
            >
              <TalkIcon name={FIELD_ICON[field.slug]} className={styles.rootIcon} />
            </div>
            <div
              className={styles.rootName}
              style={{
                left: L.rootX - 70,
                top: layout.rootY + L.rootR + 8,
                width: 140,
              }}
            >
              {field.name}
            </div>

            {layout.branches.map((b) => {
              const done = b.talks.filter((t) => status(t) === "watched").length;
              const frac = done / b.talks.length;
              const circ = 2 * Math.PI * (L.capR - 3);
              return (
                <div key={b.index}>
                  <button
                    type="button"
                    className={styles.gate}
                    data-lit={done > 0}
                    style={{
                      left: L.gateX - GATE_R,
                      top: b.centerY - GATE_R,
                      width: GATE_R * 2,
                      height: GATE_R * 2,
                    }}
                    onClick={() => focusBranch(b.index)}
                    aria-label={`Zoom to ${b.name}`}
                    title={b.name}
                  />
                  <button
                    type="button"
                    className={styles.cap}
                    data-done={done === b.talks.length}
                    style={{
                      left: layout.capX - L.capR,
                      top: b.centerY - L.capR,
                      width: L.capR * 2,
                      height: L.capR * 2,
                    }}
                    onClick={() => focusBranch(b.index)}
                    aria-label={`${b.name}: ${done} of ${b.talks.length} watched. Zoom to this branch.`}
                  >
                    <svg className={styles.capRing} viewBox={`0 0 ${L.capR * 2} ${L.capR * 2}`} aria-hidden="true">
                      <circle cx={L.capR} cy={L.capR} r={L.capR - 3} className={styles.capTrack} />
                      {done > 0 ? (
                        <circle
                          cx={L.capR}
                          cy={L.capR}
                          r={L.capR - 3}
                          className={styles.capFill}
                          strokeDasharray={`${circ * frac} ${circ}`}
                          transform={`rotate(-90 ${L.capR} ${L.capR})`}
                        />
                      ) : null}
                    </svg>
                    <TalkIcon name={branchIcon(b)} className={styles.capIcon} />
                  </button>
                  <button
                    type="button"
                    className={styles.branchLabel}
                    style={{ left: layout.labelX, top: b.centerY }}
                    onClick={() => focusBranch(b.index)}
                    tabIndex={-1}
                  >
                    <span className={styles.branchName}>{b.name}</span>
                    <span className={styles.branchCount}>
                      {done}/{b.talks.length} watched
                    </span>
                  </button>
                </div>
              );
            })}

            {layout.talks.map((t) => {
              const st = status(t);
              const ti = TIER_INDEX[t.difficulty];
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`${styles.node} ${TIER_CLASS[ti]}`}
                  data-status={st}
                  data-selected={selected === t.youtubeId}
                  data-match={q ? matches(t) : undefined}
                  style={{
                    left: t.x - t.r,
                    top: t.y - t.r,
                    width: t.r * 2,
                    height: t.r * 2,
                  }}
                  onClick={() => {
                    if (suppressClick.current) return;
                    setSelected(selected === t.youtubeId ? null : t.youtubeId);
                  }}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(t.youtubeId)}
                  onPointerLeave={() => setHovered((h) => (h === t.youtubeId ? null : h))}
                  onFocus={() => setHovered(t.youtubeId)}
                  onBlur={() => setHovered((h) => (h === t.youtubeId ? null : h))}
                  aria-label={`${t.title}. ${TIERS[ti].name}. ${statusWord(st)}.`}
                >
                  <TalkIcon name={t.icon} className={styles.nodeIcon} />
                </button>
              );
            })}

            {showNames
              ? layout.talks.map((t) => (
                  <span
                    key={`name-${t.key}`}
                    className={styles.nodeName}
                    data-status={status(t)}
                    data-match={q ? matches(t) : undefined}
                    style={{
                      left: t.x + t.r + 7,
                      top: t.y,
                      width: Math.min(168, layout.capX - L.capR - 10 - (t.x + t.r + 7)),
                    }}
                    aria-hidden="true"
                  >
                    {t.title}
                  </span>
                ))
              : null}
          </div>

          {/* tier headers: pinned to the top, follow the camera sideways */}
          <div className={styles.strip} data-overlay>
            {TIERS.map((tier, i) => {
              const center = view.x + layout.tierX[i] * view.k;
              return (
                <div
                  key={tier.level}
                  className={`${styles.tierHead} ${TIER_CLASS[i]}`}
                  style={{ left: center - 100, width: 200 }}
                >
                  <span className={styles.tierName}>{tier.name}</span>
                </div>
              );
            })}
          </div>

          {hoveredTalk ? (
            <div
              className={`${styles.tip} ${TIER_CLASS[TIER_INDEX[hoveredTalk.difficulty]]}`}
              style={{
                left: clamp(view.x + hoveredTalk.x * view.k, 130, Math.max(130, width - 130)),
                top: view.y + (hoveredTalk.y - hoveredTalk.r) * view.k - 10,
              }}
              aria-hidden="true"
            >
              <span className={styles.tipTier}>
                {TIERS[TIER_INDEX[hoveredTalk.difficulty]].name} · {statusWord(status(hoveredTalk))}
              </span>
              <span className={styles.tipTitle}>{hoveredTalk.title}</span>
              {hoveredTalk.speakers.length ? (
                <span className={styles.tipMeta}>{hoveredTalk.speakers.join(", ")}</span>
              ) : null}
            </div>
          ) : null}

          {!fitted ? (
            <div className={styles.minimap} data-overlay>
              <svg
                width={MINI_W}
                height={miniH}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                onPointerDown={(e) => {
                  miniDrag.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  miniMove(e);
                }}
                onPointerMove={(e) => miniDrag.current && miniMove(e)}
                onPointerUp={() => (miniDrag.current = false)}
                role="img"
                aria-label="Mini map. Click to move the view."
              >
                <rect width={layout.width} height={layout.height} className={styles.miniBg} />
                {layout.talks.map((t) => (
                  <circle
                    key={t.key}
                    cx={t.x}
                    cy={t.y}
                    r={t.r * 1.3}
                    className={`${styles.miniNode} ${TIER_CLASS[TIER_INDEX[t.difficulty]]}`}
                    data-status={status(t)}
                  />
                ))}
                <rect
                  x={-view.x / view.k}
                  y={(STRIP - view.y) / view.k}
                  width={width / view.k}
                  height={(height - STRIP) / view.k}
                  className={styles.miniView}
                  strokeWidth={layout.width / 100}
                />
              </svg>
            </div>
          ) : null}

          {selectedTalk ? (
            <div
              ref={popRef}
              className={`${styles.pop} ${TIER_CLASS[TIER_INDEX[selectedTalk.difficulty]]}`}
              style={{
                left: popLeft,
                top: popTop,
                width: POP_W,
                maxHeight: height - 16,
              }}
              data-overlay
            >
              <TalkDetails
                talk={selectedTalk}
                layout={layout}
                status={status}
                onClose={() => setSelected(null)}
                onSelect={setSelected}
                onToggle={onToggle}
                onWatch={onWatch}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.hint} ref={hintRef}>
        <IconLegend />
        <div className={styles.options}>
          <label className={styles.namesToggle}>
            <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} />
            Show talk names
          </label>
          <input
            type="search"
            className={styles.find}
            placeholder="Find a talk or speaker"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Find a talk in this tree"
          />
        </div>
        <div className={styles.controls} title="Drag to move. Ctrl + scroll or pinch to zoom.">
          <button type="button" onClick={() => zoomAt(1.2, width / 2, height / 2)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomAt(1 / 1.2, width / 2, height / 2)} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={measure} aria-label="Show whole tree" data-active={!fitted}>
            Fit
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Phones: the same tree as a list, grouped by branch then level.      */
/* ------------------------------------------------------------------ */

function TreeList({ layout, status, selected, setSelected, onToggle, onWatch }: SharedProps) {
  const refs = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    if (!selected) return;
    const el = refs.current.get(selected);
    if (el && el.offsetParent !== null) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  return (
    <div className={styles.list}>
      <Legend />
      {layout.branches.map((b) => {
        const done = b.talks.filter((t) => status(t) === "watched").length;
        return (
          <section key={b.index} className={styles.listBranch}>
            <header className={styles.listHead}>
              <span className={styles.branchName}>{b.name}</span>
              <span className={styles.branchMeta}>
                <span className={styles.branchMeter}>
                  <i style={{ width: `${(done / b.talks.length) * 100}%` }} />
                </span>
                {done}/{b.talks.length}
              </span>
            </header>
            {TIERS.map((tier, i) => {
              const talks = b.talks.filter((t) => TIER_INDEX[t.difficulty] === i);
              if (talks.length === 0) return null;
              return (
                <div key={tier.level} className={`${styles.listTier} ${TIER_CLASS[i]}`}>
                  <p className={styles.listTierName}>{tier.name}</p>
                  <ul>
                    {talks.map((t) => {
                      const st = status(t);
                      const open = selected === t.youtubeId;
                      return (
                        <li
                          key={t.key}
                          ref={(el) => {
                            if (el) refs.current.set(t.youtubeId, el);
                          }}
                        >
                          <button
                            type="button"
                            className={styles.listNode}
                            data-status={st}
                            aria-expanded={open}
                            onClick={() => setSelected(open ? null : t.youtubeId)}
                          >
                            <StatusGem status={st} numeral={tier.numeral} />
                            <span className={styles.nodeTitle}>{t.title}</span>
                          </button>
                          {open ? (
                            <div className={styles.listDetails}>
                              <TalkDetails
                                talk={t}
                                layout={layout}
                                status={status}
                                onSelect={setSelected}
                                onToggle={onToggle}
                                onWatch={onWatch}
                              />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <span className={styles.legend}>
      {TIERS.map((tier, i) => (
        <span key={tier.level} className={TIER_CLASS[i]}>
          <i className={styles.sw} />
          {tier.name}
        </span>
      ))}
      <span className={styles.legendState}>
        <StatusGem status="ready" numeral="" small /> ready
      </span>
      <span className={styles.legendState}>
        <StatusGem status="watched" numeral="" small /> watched
      </span>
      <span className={styles.legendState}>
        <StatusGem status="locked" numeral="" small /> locked
      </span>
    </span>
  );
}

function IconLegend() {
  return (
    <span className={styles.legend}>
      {TIERS.map((tier, i) => (
        <span key={tier.level} className={TIER_CLASS[i]}>
          <i className={styles.sw} />
          {tier.name}
        </span>
      ))}
      {(["ready", "watched", "locked"] as const).map((st) => (
        <span key={st} className={styles.legendState}>
          <i className={styles.legendNode} data-status={st}>
            <span className={styles.slot} />
          </i>
          {st}
        </span>
      ))}
    </span>
  );
}

function StatusGem({ status, numeral, small }: { status: TalkStatus; numeral: string; small?: boolean }) {
  return (
    <span className={styles.gem} data-status={status} data-small={small ? "true" : undefined} aria-hidden="true">
      <span>{status === "watched" ? "✓" : status === "locked" ? <LockIcon /> : numeral}</span>
    </span>
  );
}

function TalkDetails({
  talk,
  layout,
  status,
  onClose,
  onSelect,
  onToggle,
  onWatch,
}: {
  talk: PlacedTalk;
  layout: FieldLayout;
  status: (t: PlacedTalk) => TalkStatus;
  onClose?: () => void;
  onSelect: (youtubeId: string) => void;
  onToggle: (t: PlacedTalk) => void;
  onWatch: (t: PlacedTalk) => void;
}) {
  const st = status(talk);
  const tier = TIERS[TIER_INDEX[talk.difficulty]];
  const parents = talk.parents.map((id) => layout.byYoutubeId.get(id)).filter((t): t is PlacedTalk => Boolean(t));
  const unlocks = layout.talks.filter((t) => t.parents.includes(talk.youtubeId));
  const branch = layout.branches[talk.branchIndex];

  return (
    <div className={styles.details}>
      {onClose ? (
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ×
        </button>
      ) : null}
      <div className={styles.thumb}>
        <img
          src={thumbnailSrc(talk.youtubeId, "mq")}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
        {talk.durationSeconds ? <span className={styles.thumbDur}>{formatDuration(talk.durationSeconds)}</span> : null}
      </div>
      <p className={styles.detailChips}>
        <span className={styles.tierChip}>{tier.name}</span>
        <span>{branch.name}</span>
        {talk.event ? <span>{talk.event}</span> : null}
      </p>
      <h2 className={styles.detailTitle}>{talk.title}</h2>
      {talk.speakers.length ? <p className={styles.speakers}>{talk.speakers.join(", ")}</p> : null}
      {talk.teaser ? <p className={styles.teaser}>{talk.teaser}</p> : null}
      {st === "locked" && parents.length ? (
        <p className={styles.lockNote}>
          Locked until you watch {parents.length === 1 ? "the talk" : "one of the talks"} it builds on. You can still
          open it.
        </p>
      ) : null}
      <div className={styles.actions}>
        <Link href={`/talks/${talk.slug}`} className={styles.primary}>
          Open talk
        </Link>
        <a
          href={`https://www.youtube.com/watch?v=${talk.youtubeId}`}
          target="_blank"
          rel="noreferrer"
          className={styles.secondary}
          onClick={() => onWatch(talk)}
        >
          YouTube ↗
        </a>
        <button type="button" className={styles.secondary} onClick={() => onToggle(talk)} disabled={st === "locked"}>
          {st === "watched" ? "Unmark" : "Mark watched"}
        </button>
      </div>
      {parents.length ? (
        <div className={styles.links}>
          <p className={styles.statLabel}>Builds on</p>
          <ul>
            {parents.map((p) => (
              <li key={p.youtubeId}>
                <button type="button" onClick={() => onSelect(p.youtubeId)} data-status={status(p)}>
                  <span aria-hidden="true">{status(p) === "watched" ? "✓" : "○"}</span> {p.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {unlocks.length ? (
        <div className={styles.links}>
          <p className={styles.statLabel}>Unlocks</p>
          <ul>
            {unlocks.map((u) => (
              <li key={u.youtubeId}>
                <button type="button" onClick={() => onSelect(u.youtubeId)} data-status={status(u)}>
                  <span aria-hidden="true">→</span> {u.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="11" height="13" viewBox="0 0 14 16" aria-hidden="true">
      <path d="M4 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="2" y="7" width="10" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}
