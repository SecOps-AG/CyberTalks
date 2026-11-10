"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const MIN_K = 0.3;
const MAX_K = 1.6;
const TIER_CLASS = [styles.t1, styles.t2, styles.t3, styles.t4];
const FIELD_KEY = "cybertalks:skill-tree-field";

function clampK(k: number) {
  return Math.min(MAX_K, Math.max(MIN_K, k));
}

function edgePath(x1: number, y1: number, x2: number, y2: number) {
  const mid = (x1 + x2) / 2;
  return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
}

function rankNumeral(index: number) {
  return ["I", "II", "III"][index] ?? String(index + 1);
}

export function SkillTreeClient({ data }: { data: SkillTreeFile }) {
  const [fieldSlug, setFieldSlug] = useState(data.fields[0].slug);
  const [watched, setWatched] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 1200, h: 700 });

  const field: SkillField = data.fields.find((f) => f.slug === fieldSlug) ?? data.fields[0];
  const layout: FieldLayout = useMemo(() => layoutField(field), [field]);
  const status = useCallback((t: PlacedTalk): TalkStatus => talkStatus(t, layout, watched), [layout, watched]);
  const rank = useMemo(() => rankFor(layout, watched), [layout, watched]);
  const selectedTalk = selected ? (layout.byYoutubeId.get(selected) ?? null) : null;

  const viewportRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  // ---- watched state (shared with Saved and the talk pages) ----
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

  // ---- field from the URL hash, else the last one used ----
  useEffect(() => {
    const fromHash = () => {
      const slug = window.location.hash.slice(1);
      if (data.fields.some((f) => f.slug === slug)) return slug;
      try {
        const saved = window.localStorage.getItem(FIELD_KEY);
        if (saved && data.fields.some((f) => f.slug === saved)) return saved;
      } catch {
        // Storage blocked; fall back to the first field.
      }
      return null;
    };
    const apply = () => {
      const slug = fromHash();
      if (slug) setFieldSlug(slug);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [data.fields]);

  // ---- viewport size ----
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const home = useCallback(() => {
    const k = clampK(Math.min(1, (size.w - 24) / layout.width));
    setView({ k, x: Math.max(12, (size.w - layout.width * k) / 2), y: 52 });
  }, [layout.width, size.w]);

  const fit = useCallback(() => {
    const k = clampK(Math.min((size.w - 24) / layout.width, (size.h - 72) / layout.height));
    setView({ k, x: (size.w - layout.width * k) / 2, y: 52 + Math.max(0, (size.h - 60 - layout.height * k) / 2) });
  }, [layout.height, layout.width, size.h, size.w]);

  // Reset the camera when the field changes or the canvas first gets a real size.
  const sized = size.w !== 1200 || size.h !== 700;
  useEffect(() => {
    home();
    setSelected(null);
  }, [fieldSlug, sized]);

  const centerOn = useCallback(
    (x: number, y: number, k = viewRef.current.k) => {
      setView({ k, x: size.w / 2 - x * k - (size.w > 900 && selected ? 180 : 0), y: size.h / 2 - y * k });
    },
    [selected, size.h, size.w],
  );

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const k = clampK(v.k * factor);
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
    });
  }, []);

  // ---- pointer pan + pinch ----
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
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = clampK(pinch.current.k * (d / pinch.current.d));
      zoomAt(target / viewRef.current.k, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
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
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (drag.current?.moved) {
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
    }
    drag.current = null;
  }

  // Wheel zoom needs a non-passive listener so the page does not scroll.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[data-overlay]")) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  function onKeyDown(e: React.KeyboardEvent) {
    const step = 80;
    const c = () => [size.w / 2, size.h / 2] as const;
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
        zoomAt(1.2, ...c());
        break;
      case "-":
        zoomAt(1 / 1.2, ...c());
        break;
      case "0":
        fit();
        break;
      case "Escape":
        setSelected(null);
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  // ---- actions ----
  function chooseField(slug: string) {
    setFieldSlug(slug);
    try {
      window.localStorage.setItem(FIELD_KEY, slug);
    } catch {
      // Storage blocked; the hash still records it.
    }
    history.replaceState(null, "", `#${slug}`);
  }

  function selectTalk(t: PlacedTalk) {
    if (suppressClick.current) return;
    setSelected(t.youtubeId);
  }

  function focusBranch(index: number) {
    if (suppressClick.current) return;
    const b = layout.branches[index];
    const k = clampK(Math.min(1.1, (size.w - 40) / (layout.width - LAYOUT.hubX + 20), (size.h - 100) / b.height));
    setSelected(null);
    setView({ k, x: 20 - LAYOUT.hubX * k + 10, y: (size.h + 40) / 2 - b.centerY * k });
  }

  const nextUp = useMemo(() => {
    const ready = layout.talks.filter((t) => status(t) === "ready");
    ready.sort((a, b) => TIER_INDEX[a.difficulty] - TIER_INDEX[b.difficulty] || a.branchIndex - b.branchIndex);
    return ready[0] ?? null;
  }, [layout, status]);

  function goNext() {
    if (!nextUp) return;
    setSelected(nextUp.youtubeId);
    centerOn(nextUp.x + LAYOUT.cardW / 2, nextUp.y + LAYOUT.cardH / 2, Math.max(viewRef.current.k, 0.85));
  }

  function toggleWatched(t: PlacedTalk) {
    if (status(t) === "watched") {
      for (const id of watched) if (id === t.id || id.endsWith(`-${t.youtubeId}`)) unmarkWatched(id);
    } else {
      markWatched(t.id);
    }
  }

  // ---- minimap ----
  const MINI_W = 220;
  const miniScale = Math.min(MINI_W / layout.width, 150 / layout.height);
  const miniH = layout.height * miniScale;
  const miniDrag = useRef(false);
  function miniMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const wx = ((e.clientX - rect.left) / rect.width) * layout.width;
    const wy = ((e.clientY - rect.top) / rect.height) * layout.height;
    setView((v) => ({ ...v, x: size.w / 2 - wx * v.k, y: size.h / 2 - wy * v.k }));
  }

  // ---- render helpers ----
  const tierOf = (t: { difficulty: PlacedTalk["difficulty"] }) => TIER_INDEX[t.difficulty];
  const isPathEdge = (from: string, to: string) => selected !== null && (selected === from || selected === to);

  const edges: { key: string; d: string; cls: string }[] = [];
  for (const b of layout.branches) {
    edges.push({
      key: `root-${b.index}`,
      d: edgePath(LAYOUT.rootX + LAYOUT.rootSize, layout.rootY, LAYOUT.hubX, b.centerY),
      cls: styles.edgeDone,
    });
  }
  for (const t of layout.talks) {
    const st = status(t);
    const targetX = t.x;
    const targetY = t.y + LAYOUT.cardH / 2;
    if (t.parents.length === 0) {
      const b = layout.branches[t.branchIndex];
      edges.push({
        key: `hub-${t.key}`,
        d: edgePath(LAYOUT.hubX + LAYOUT.hubW, b.centerY, targetX, targetY),
        cls: `${st === "watched" ? styles.edgeDone : styles.edgeOpen} ${selected === t.youtubeId ? styles.edgeFocus : ""}`,
      });
      continue;
    }
    for (const pid of t.parents) {
      const p = layout.byYoutubeId.get(pid);
      if (!p) continue;
      const parentDone = status(p) === "watched";
      const cls = parentDone && st === "watched" ? styles.edgeDone : parentDone ? styles.edgeOpen : styles.edgeLocked;
      const cross = p.branchIndex !== t.branchIndex ? styles.edgeCross : "";
      edges.push({
        key: `${pid}->${t.key}`,
        d: edgePath(p.x + LAYOUT.cardW, p.y + LAYOUT.cardH / 2, targetX, targetY),
        cls: `${cls} ${cross} ${isPathEdge(pid, t.youtubeId) ? styles.edgeFocus : ""}`,
      });
    }
  }

  const readyCount = layout.talks.filter((t) => status(t) === "ready").length;
  const top = RANKS[RANKS.length - 1].minSeconds;

  return (
    <div className={styles.page}>
      {/* ---------- header: title, fields, stats ---------- */}
      <section className={styles.top}>
        <div className={`panel ${styles.intro}`}>
          <p className="eyebrow">Career paths · built from rated talks</p>
          <h1 className={styles.title}>Skill Tree</h1>
          <p className={styles.lede}>
            Pick a field. Each branch is a specialty, and each node is a real conference talk. Start in
            Tier I on the left and work right. Watching a talk unlocks the harder talks it connects to.
          </p>
          <div className={styles.fields} role="tablist" aria-label="Field">
            {data.fields.map((f) => {
              const total = f.branches.reduce((n, b) => n + b.talks.length, 0);
              const done = f.branches.reduce(
                (n, b) => n + b.talks.filter((t) => watched.has(t.id) || [...watched].some((w) => w.endsWith(`-${t.youtubeId}`))).length,
                0,
              );
              return (
                <button
                  key={f.slug}
                  type="button"
                  role="tab"
                  aria-selected={f.slug === field.slug}
                  className={styles.fieldTab}
                  onClick={() => chooseField(f.slug)}
                >
                  <span>{f.name}</span>
                  <span className={styles.fieldCount}>
                    {done}/{total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`panel ${styles.stats}`} aria-live="polite">
          <div className={styles.rankRow}>
            <div className={styles.badge} aria-hidden="true">
              {rankNumeral(rank.rankIndex)}
            </div>
            <div className={styles.rankText}>
              <p className="label">{field.name} rank</p>
              <p className={styles.rankName}>{rank.rank.name}</p>
              <p className={styles.ladder}>
                {RANKS.map((r, i) => (
                  <span key={r.name} data-on={i === rank.rankIndex}>
                    {r.name}
                  </span>
                ))}
              </p>
            </div>
          </div>
          <div className={styles.rankBar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rank.ladder * 100)} aria-label="Progress to Elite">
            <i style={{ width: `${rank.ladder * 100}%` }} />
            {RANKS.slice(1, -1).map((r) => (
              <u key={r.name} style={{ left: `${(r.minSeconds / top) * 100}%` }} />
            ))}
          </div>
          <dl className={styles.nums}>
            <div>
              <dt className="label">Watched</dt>
              <dd>{hoursMinutes(rank.watchedSeconds)}</dd>
            </div>
            <div>
              <dt className="label">Talks</dt>
              <dd>
                {rank.watchedTalks} / {layout.talks.length}
              </dd>
            </div>
            <div>
              <dt className="label">Ready</dt>
              <dd>{readyCount}</dd>
            </div>
          </dl>
          <div className={styles.statsFoot}>
            <span>
              {rank.next
                ? `${hoursMinutes(rank.next.minSeconds - rank.watchedSeconds)} to ${rank.next.name}`
                : "Top rank in this field"}
            </span>
            <button type="button" className={styles.nextBtn} onClick={goNext} disabled={!nextUp}>
              Next talk →
            </button>
          </div>
        </div>
      </section>

      {/* ---------- canvas ---------- */}
      <section className={styles.bleed} aria-label={`${field.name} skill tree`}>
        <div
          ref={viewportRef}
          className={styles.viewport}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          aria-describedby="skill-tree-help"
        >
          {/* tier headers follow the camera horizontally and stay pinned to the top */}
          <div className={styles.tierStrip} data-overlay>
            {TIERS.map((tier, i) => {
              const left = view.x + LAYOUT.tierX[i] * view.k;
              const width = LAYOUT.cardW * view.k;
              return (
                <div
                  key={tier.level}
                  className={`${styles.tierHead} ${TIER_CLASS[i]}`}
                  data-compact={width < 230}
                  style={{ left, width }}
                >
                  <span className={styles.tierNum}>{width < 110 ? tier.numeral : `Tier ${tier.numeral}`}</span>
                  <span className={styles.tierName}>{tier.name}</span>
                  <a
                    className={styles.tierMore}
                    href={`/search?track=${field.track}&difficulty=${tier.level}`}
                    rel="nofollow"
                  >
                    {field.rated[tier.level].toLocaleString()} rated →
                  </a>
                </div>
              );
            })}
          </div>

          <div
            className={styles.world}
            style={{
              width: layout.width,
              height: layout.height,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            }}
          >
            {TIERS.map((tier, i) => (
              <div
                key={tier.level}
                className={`${styles.band} ${TIER_CLASS[i]}`}
                style={{ left: LAYOUT.tierX[i] - 32, width: LAYOUT.cardW + 64, height: layout.height }}
              />
            ))}
            {layout.branches.map((b) => (
              <div key={b.index} className={styles.lane} style={{ top: b.y, height: b.height, left: LAYOUT.hubX - 14, width: layout.width - LAYOUT.hubX }} />
            ))}

            <svg className={styles.edges} width={layout.width} height={layout.height} aria-hidden="true">
              {edges.map((e) => (
                <path key={e.key} d={e.d} className={`${styles.edge} ${e.cls}`} />
              ))}
            </svg>

            <div className={styles.root} style={{ left: LAYOUT.rootX, top: layout.rootY - LAYOUT.rootSize / 2, width: LAYOUT.rootSize, height: LAYOUT.rootSize }}>
              <div>
                <strong>{field.name}</strong>
                <span>{field.branches.length} branches</span>
              </div>
            </div>

            {layout.branches.map((b) => {
              const done = b.talks.filter((t) => status(t) === "watched").length;
              return (
                <button
                  key={b.index}
                  type="button"
                  className={styles.hub}
                  style={{ left: LAYOUT.hubX, top: b.centerY - LAYOUT.hubH / 2, width: LAYOUT.hubW, height: LAYOUT.hubH }}
                  onClick={() => focusBranch(b.index)}
                  title="Zoom to this branch"
                >
                  <span className={styles.hubNum}>Branch {b.index + 1}</span>
                  <span className={styles.hubName}>{b.name}</span>
                  <span className={styles.hubMeter}>
                    <i style={{ width: `${(done / b.talks.length) * 100}%` }} />
                  </span>
                </button>
              );
            })}

            {layout.talks.map((t) => {
              const st = status(t);
              const tier = TIERS[tierOf(t)];
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`${styles.card} ${TIER_CLASS[tierOf(t)]}`}
                  data-status={st}
                  data-selected={selected === t.youtubeId}
                  style={{ left: t.x, top: t.y, width: LAYOUT.cardW, height: LAYOUT.cardH }}
                  onClick={() => selectTalk(t)}
                  aria-label={`${t.title}. Tier ${tier.numeral}, ${tier.name}. ${st === "watched" ? "Watched" : st === "ready" ? "Ready to watch" : "Locked"}.`}
                >
                  <span className={styles.hex} aria-hidden="true">
                    <span>{st === "watched" ? "✓" : st === "locked" ? <LockIcon /> : tier.numeral}</span>
                  </span>
                  <span className={styles.cardText}>
                    <span className={styles.cardTitle}>{t.title}</span>
                    <span className={styles.cardMeta}>
                      {t.speakers.slice(0, 2).join(", ") || "Unknown speaker"}
                      {t.durationSeconds ? ` · ${Math.round(t.durationSeconds / 60)} min` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* controls */}
          <div className={styles.controls} data-overlay>
            <button type="button" onClick={() => zoomAt(1.2, size.w / 2, size.h / 2)} aria-label="Zoom in">
              +
            </button>
            <button type="button" onClick={() => zoomAt(1 / 1.2, size.w / 2, size.h / 2)} aria-label="Zoom out">
              −
            </button>
            <button type="button" onClick={fit} aria-label="Fit whole tree">
              Fit
            </button>
            <button type="button" onClick={home} aria-label="Reset view">
              ⌂
            </button>
          </div>

          <p id="skill-tree-help" className={styles.help} data-overlay>
            Drag to move · scroll or pinch to zoom · arrow keys work too
          </p>

          {/* minimap */}
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
              {layout.branches.map((b) => (
                <rect key={b.index} x={LAYOUT.hubX} y={b.centerY - LAYOUT.hubH / 2} width={LAYOUT.hubW} height={LAYOUT.hubH} className={styles.miniHub} />
              ))}
              {layout.talks.map((t) => (
                <rect
                  key={t.key}
                  x={t.x}
                  y={t.y}
                  width={LAYOUT.cardW}
                  height={LAYOUT.cardH}
                  className={`${styles.miniNode} ${TIER_CLASS[tierOf(t)]}`}
                  data-status={status(t)}
                />
              ))}
              <rect
                x={-view.x / view.k}
                y={-view.y / view.k}
                width={size.w / view.k}
                height={size.h / view.k}
                className={styles.miniView}
                strokeWidth={layout.width / 110}
              />
            </svg>
          </div>

          {/* talk drawer */}
          {selectedTalk ? (
            <TalkDrawer
              talk={selectedTalk}
              layout={layout}
              status={status}
              onClose={() => setSelected(null)}
              onSelect={(id) => {
                const t = layout.byYoutubeId.get(id);
                if (!t) return;
                setSelected(id);
                centerOn(t.x + LAYOUT.cardW / 2, t.y + LAYOUT.cardH / 2);
              }}
              onToggle={toggleWatched}
              onWatch={(t) => markWatched(t.id)}
            />
          ) : null}
        </div>

        <div className={styles.legend}>
          {TIERS.map((tier, i) => (
            <span key={tier.level} className={TIER_CLASS[i]}>
              <i className={styles.sw} />
              Tier {tier.numeral} · {tier.name}
            </span>
          ))}
          <span className={styles.legendKey}>
            <i className={styles.keyLocked} /> locked <i className={styles.keyReady} /> ready <i className={styles.keyDone} /> watched
          </span>
          <span className={styles.legendNote}>
            {field.unrated.toLocaleString()} {field.name} talks have no difficulty rating yet and are not in the tree.
          </span>
        </div>
      </section>
    </div>
  );
}

function TalkDrawer({
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
  onClose: () => void;
  onSelect: (youtubeId: string) => void;
  onToggle: (t: PlacedTalk) => void;
  onWatch: (t: PlacedTalk) => void;
}) {
  const st = status(talk);
  const tierIndex = TIER_INDEX[talk.difficulty];
  const tier = TIERS[tierIndex];
  const parents = talk.parents.map((id) => layout.byYoutubeId.get(id)).filter((t): t is PlacedTalk => Boolean(t));
  const unlocks = layout.talks.filter((t) => t.parents.includes(talk.youtubeId));
  const branch = layout.branches[talk.branchIndex];
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, [talk.youtubeId]);

  return (
    <aside className={`${styles.drawer} ${TIER_CLASS[tierIndex]}`} data-overlay aria-label="Talk details">
      <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className={styles.thumb}>
        <img
          src={thumbnailSrc(talk.youtubeId, "mq")}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
        {st === "locked" ? <span className={styles.thumbLock}>Locked</span> : null}
        {talk.durationSeconds ? <span className={styles.thumbDur}>{formatDuration(talk.durationSeconds)}</span> : null}
      </div>
      <div className={styles.drawerChips}>
        <span className={styles.tierChip}>
          Tier {tier.numeral} · {tier.name}
        </span>
        {talk.event ? <span className="meta-chip">{talk.event}</span> : null}
        <span className="meta-chip">{branch.name}</span>
      </div>
      <h2 className={styles.drawerTitle}>{talk.title}</h2>
      {talk.speakers.length ? <p className={styles.speakers}>{talk.speakers.join(", ")}</p> : null}
      {talk.teaser ? <p className={styles.teaser}>{talk.teaser}</p> : null}

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
          {st === "watched" ? "Mark unwatched" : "Mark watched"}
        </button>
      </div>
      {st === "locked" ? (
        <p className={styles.lockNote}>Watch one of the talks below to unlock this one. You can still open it any time.</p>
      ) : null}

      <div className={styles.links}>
        <p className="label">Unlocked by</p>
        {parents.length ? (
          <ul>
            {parents.map((p) => (
              <li key={p.youtubeId}>
                <button type="button" onClick={() => onSelect(p.youtubeId)} data-status={status(p)}>
                  <span aria-hidden="true">{status(p) === "watched" ? "✓" : "○"}</span> {p.title}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Nothing. This is a starting point for the {branch.name.toLowerCase()} branch.</p>
        )}
      </div>
      {unlocks.length ? (
        <div className={styles.links}>
          <p className="label">Unlocks</p>
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
    </aside>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
      <path d="M4 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2" y="7" width="10" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}
