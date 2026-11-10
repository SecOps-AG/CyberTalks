"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getSavedState, markWatched, unmarkWatched } from "@/lib/saved";
import { thumbnailSrc } from "@/lib/materials";
import { formatDuration } from "@/lib/search";
import {
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
import styles from "./skill-tree.module.css";

type View = { x: number; y: number; k: number };

const TIER_CLASS = [styles.t1, styles.t2, styles.t3, styles.t4];
const FIELD_KEY = "cybertalks:skill-tree-field";
/** Tier header strip height inside the canvas, in screen pixels. */
const STRIP = 46;
const PAD = 16;
/** Below this zoom the card titles stop being comfortable to read. */
const READABLE_K = 0.8;
const MAX_K = 1.6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function edgePath(x1: number, y1: number, x2: number, y2: number) {
  const mid = (x1 + x2) / 2;
  return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
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
              Real conference talks, beginner to expert. Watching one unlocks the talks it leads to.
            </p>
          </div>
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
                >
                  {f.name}
                  <span className={styles.fieldCount}>
                    {p.done}/{p.total}
                  </span>
                </button>
              );
            })}
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
        <TreeCanvas {...shared} />
      </div>
      <div className={styles.mobileOnly}>
        <TreeList {...shared} />
      </div>

      <p className={styles.footnote}>
        {field.unrated.toLocaleString()} {field.name} talks have no difficulty rating yet, so they are not in
        the tree.{" "}
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

function TreeCanvas({ field, layout, status, selected, setSelected, onToggle, onWatch }: SharedProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(640);
  const [fitK, setFitK] = useState(1);
  const [view, setView] = useState<View>({ x: PAD, y: STRIP, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;

  // Size the canvas so the whole tree fits the rest of the screen, never
  // smaller than readable. If it can't fit, the canvas grows and the page scrolls.
  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el || el.offsetParent === null) return;
    const w = el.clientWidth;
    const topOnPage = el.getBoundingClientRect().top + window.scrollY;
    const below = (hintRef.current?.offsetHeight ?? 44) + 12;
    const room = Math.max(420, window.innerHeight - topOnPage - below);
    const k = clamp(Math.min((w - PAD * 2) / layout.width, (room - STRIP - PAD) / layout.height, 1.15), READABLE_K, MAX_K);
    const h = Math.round(layout.height * k + STRIP + PAD);
    setWidth(w);
    setHeight(h);
    setFitK(k);
    setView({ k, x: (w - layout.width * k) / 2, y: STRIP + (h - STRIP - layout.height * k) / 2 });
  }, [layout]);

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
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
    });
  }, []);

  // ---- pan / pinch ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; k: number } | null>(null);
  const suppressClick = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-overlay]")) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: viewRef.current.k };
      drag.current = null;
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y, moved: false };
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
  const fittedRef = useRef(fitted);
  fittedRef.current = fitted;

  function onKeyDown(e: React.KeyboardEvent) {
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
    const k = clamp(Math.min(1.25, (height - STRIP - PAD * 2) / b.height), fitK, MAX_K);
    // Show the label column through the branch's last talk; if that is wider than the screen, keep the left edge.
    const span = Math.max(...b.talks.map((t) => t.x + LAYOUT.cardW));
    const x = span * k <= width - PAD * 2 ? (width - span * k) / 2 : PAD;
    setSelected(null);
    setView({ k, x, y: STRIP + (height - STRIP) / 2 - (b.y + b.height / 2) * k });
  }

  // ---- edges ----
  const edges: { key: string; d: string; cls: string }[] = [];
  for (const t of layout.talks) {
    const st = status(t);
    const tx = t.x;
    const ty = t.y + LAYOUT.cardH / 2;
    const focus = selected === t.youtubeId ? styles.edgeFocus : "";
    if (t.parents.length === 0) {
      const b = layout.branches[t.branchIndex];
      edges.push({
        key: `label-${t.key}`,
        d: edgePath(LAYOUT.labelW, b.y + b.height / 2, tx, ty),
        cls: `${st === "watched" ? styles.edgeDone : styles.edgeOpen} ${focus}`,
      });
      continue;
    }
    for (const pid of t.parents) {
      const p = layout.byYoutubeId.get(pid);
      if (!p) continue;
      const parentDone = status(p) === "watched";
      const cls = parentDone && st === "watched" ? styles.edgeDone : parentDone ? styles.edgeOpen : styles.edgeLocked;
      const cross = p.branchIndex !== t.branchIndex ? styles.edgeCross : "";
      const f = selected === pid || selected === t.youtubeId ? styles.edgeFocus : "";
      edges.push({
        key: `${pid}->${t.key}`,
        d: edgePath(p.x + LAYOUT.cardW, p.y + LAYOUT.cardH / 2, tx, ty),
        cls: `${cls} ${cross} ${f}`,
      });
    }
  }

  const selectedTalk = selected ? (layout.byYoutubeId.get(selected) ?? null) : null;

  // ---- talk card placement, next to its node ----
  const popRef = useRef<HTMLDivElement>(null);
  const [popTop, setPopTop] = useState(0);
  const POP_W = 340;
  let popLeft = 0;
  let anchorTop = 0;
  if (selectedTalk) {
    const right = view.x + (selectedTalk.x + LAYOUT.cardW) * view.k + 14;
    const left = view.x + selectedTalk.x * view.k - 14 - POP_W;
    popLeft = right + POP_W <= width - 8 ? right : Math.max(8, left);
    anchorTop = view.y + selectedTalk.y * view.k;
  }
  useLayoutEffect(() => {
    if (!selectedTalk || !popRef.current) return;
    const h = popRef.current.offsetHeight;
    setPopTop(clamp(anchorTop - 12, 8, Math.max(8, height - h - 8)));
  }, [selectedTalk, anchorTop, height]);

  // Keep the selected node on screen (e.g. after "Next talk").
  useEffect(() => {
    if (!selectedTalk || width === 0) return;
    const v = viewRef.current;
    const x0 = v.x + selectedTalk.x * v.k;
    const y0 = v.y + selectedTalk.y * v.k;
    const x1 = x0 + LAYOUT.cardW * v.k;
    const y1 = y0 + LAYOUT.cardH * v.k;
    if (x0 >= 0 && x1 <= width && y0 >= STRIP && y1 <= height) {
      if (viewportRef.current) {
        const r = viewportRef.current.getBoundingClientRect();
        if (r.top < 0 || r.top + y1 > window.innerHeight) {
          window.scrollTo({ top: window.scrollY + r.top + y0 - window.innerHeight / 2, behavior: "smooth" });
        }
      }
      return;
    }
    setView({
      k: v.k,
      x: width / 2 - (selectedTalk.x + LAYOUT.cardW / 2) * v.k,
      y: (height + STRIP) / 2 - (selectedTalk.y + LAYOUT.cardH / 2) * v.k,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTalk?.youtubeId]);

  // ---- minimap (only once zoomed or panned away from the fitted view) ----
  const MINI_W = 200;
  const miniH = (layout.height / layout.width) * MINI_W;
  const miniDrag = useRef(false);
  function miniMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const wx = ((e.clientX - rect.left) / rect.width) * layout.width;
    const wy = ((e.clientY - rect.top) / rect.height) * layout.height;
    setView((v) => ({ ...v, x: width / 2 - wx * v.k, y: (height + STRIP) / 2 - wy * v.k }));
  }

  return (
    <section className={styles.board} aria-label={`${field.name} skill tree`}>
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
      >
        <div
          className={styles.world}
          style={{ width: layout.width, height: layout.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
        >
          {layout.branches.map((b) => (
            <div key={`lane-${b.index}`} className={styles.lane} style={{ top: b.y, height: b.height, width: layout.width }} />
          ))}
          {TIERS.map((tier, i) => (
            <div
              key={tier.level}
              className={`${styles.column} ${TIER_CLASS[i]}`}
              style={{ left: LAYOUT.tierX[i] - 14, width: LAYOUT.cardW + 28, height: layout.height }}
            />
          ))}

          <svg className={styles.edges} width={layout.width} height={layout.height} aria-hidden="true">
            {edges.map((e) => (
              <path key={e.key} d={e.d} className={`${styles.edge} ${e.cls}`} />
            ))}
          </svg>

          {layout.branches.map((b) => {
            const done = b.talks.filter((t) => status(t) === "watched").length;
            return (
              <button
                key={b.index}
                type="button"
                className={styles.branch}
                style={{ top: b.y + 4, height: b.height - 8, width: LAYOUT.labelW }}
                onClick={() => focusBranch(b.index)}
                title="Zoom to this branch"
              >
                <span className={styles.branchName}>{b.name}</span>
                <span className={styles.branchMeta}>
                  <span className={styles.branchMeter}>
                    <i style={{ width: `${(done / b.talks.length) * 100}%` }} />
                  </span>
                  {done}/{b.talks.length}
                </span>
              </button>
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
                style={{ left: t.x, top: t.y, width: LAYOUT.cardW, height: LAYOUT.cardH }}
                onClick={() => {
                  if (suppressClick.current) return;
                  setSelected(selected === t.youtubeId ? null : t.youtubeId);
                }}
                title={t.title}
                aria-label={`${t.title}. ${TIERS[ti].name}. ${st === "watched" ? "Watched" : st === "ready" ? "Ready to watch" : "Locked"}.`}
              >
                <StatusGem status={st} numeral={TIERS[ti].numeral} />
                <span className={styles.nodeTitle}>{t.title}</span>
              </button>
            );
          })}
        </div>

        {/* tier headers: pinned to the top, follow the camera sideways */}
        <div className={styles.strip} data-overlay>
          {TIERS.map((tier, i) => {
            const left = view.x + LAYOUT.tierX[i] * view.k;
            const w = LAYOUT.cardW * view.k;
            return (
              <div key={tier.level} className={`${styles.tierHead} ${TIER_CLASS[i]}`} style={{ left, width: w }}>
                <span className={styles.tierName}>{tier.name}</span>
                <a className={styles.tierMore} href={`/search?track=${field.track}&difficulty=${tier.level}`} rel="nofollow">
                  {field.rated[tier.level].toLocaleString()} rated talks →
                </a>
              </div>
            );
          })}
          <div className={styles.branchHead} style={{ left: view.x, width: LAYOUT.labelW * view.k }}>
            Branch
          </div>
        </div>


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
                <rect
                  key={t.key}
                  x={t.x}
                  y={t.y}
                  width={LAYOUT.cardW}
                  height={LAYOUT.cardH}
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
            style={{ left: popLeft, top: popTop, width: POP_W, maxHeight: height - 16 }}
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
      <div className={styles.hint} ref={hintRef}>
        <Legend />
        <span className={styles.hintText}>Drag to move · Ctrl + scroll or pinch to zoom · click a branch to zoom in</span>
        <div className={styles.controls}>
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
