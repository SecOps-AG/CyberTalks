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
  watchedIn,
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
const TIER_COLOR = ["#7dff6a", "#00f0ff", "#ffb000", "#ff2bd6"];
const TIER_GLOW = ["rgba(125,255,106,.07)", "rgba(0,240,255,.07)", "rgba(255,176,0,.065)", "rgba(255,43,214,.065)"];
const LOCKED_COLOR = "rgba(125,255,106,.34)";
const FIELD_KEY = "cybertalks:skill-tree-field";
/** Height of the pinned tier header strip, screen pixels. */
const HEAD = 78;
/** Below this zoom only the hex icons show; above it, talk names. */
const NAMES_AT = 0.72;
const MIN_K = 0.15;
const MAX_K = 1.6;
const MINI_W = 220;
const MINI_H = 132;
const RING = 2 * Math.PI * 28;

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

function curve(x1: number, y1: number, x2: number, y2: number) {
  const m = (x1 + x2) / 2;
  return `M${x1} ${y1}C${m} ${y1} ${m} ${y2} ${x2} ${y2}`;
}

const minutes = (seconds: number) => `${Math.round(seconds / 60)} min`;

export function SkillTreeClient({ data }: { data: SkillTreeFile }) {
  const [fieldSlug, setFieldSlug] = useState(data.fields[0].slug);
  const [watched, setWatched] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
  /** Ask the canvas to zoom to a talk; `n` makes a repeat request for the same talk count. */
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [query, setQuery] = useState("");

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
    setFocus(null);
    try {
      window.localStorage.setItem(FIELD_KEY, slug);
    } catch {
      // Storage blocked; the hash still records it.
    }
    history.replaceState(null, "", `#${slug}`);
  }

  function goTo(youtubeId: string) {
    setSelected(youtubeId);
    setFocus((f) => ({ id: youtubeId, n: (f?.n ?? 0) + 1 }));
  }

  const nextUp = useMemo(() => {
    const ready = layout.talks.filter((t) => status(t) === "ready");
    ready.sort((a, b) => TIER_INDEX[a.tier] - TIER_INDEX[b.tier] || a.branchIndex - b.branchIndex || a.y - b.y);
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
        if (watchedIn(watched, t)) done += 1;
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
          >
            {f.name}
            <span className={styles.tabProgress} aria-hidden="true">
              <i style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
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
    goTo,
    query,
    onToggle: toggleWatched,
    onWatch: (t: PlacedTalk) => markWatched(t.id),
  };

  return (
    <div className={styles.page}>
      <section className={styles.head}>
        <div className={`panel ${styles.intro}`}>
          <p className={styles.eyebrow}>A suggested watch order</p>
          <h1 className={styles.title}>Skill Tree</h1>
          <p className={styles.lede}>
            An experiment: talks from the archive, sorted by difficulty and topic into suggested paths. Treat it as a
            loose guide to what to watch next, not a course.
          </p>
        </div>

        <div className={`panel ${styles.stats}`} aria-live="polite">
          <div className={styles.rankRow}>
            <div className={styles.badge} aria-hidden="true">
              {["I", "II", "III"][rank.rankIndex]}
            </div>
            <div className={styles.rankText}>
              <p className={styles.statLabel}>{field.name} rank</p>
              <p className={styles.rankName}>{rank.rank.name}</p>
            </div>
          </div>
          <div>
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
          <div className={styles.statFoot}>
            <dl className={styles.nums}>
              <div>
                <dt className={styles.statLabel}>Watched</dt>
                <dd>{hoursMinutes(rank.watchedSeconds)}</dd>
              </div>
              <div>
                <dt className={styles.statLabel}>Talks</dt>
                <dd>
                  {rank.watchedTalks} / {layout.talks.length}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              className={styles.nextBtn}
              disabled={!nextUp}
              onClick={() => nextUp && goTo(nextUp.youtubeId)}
            >
              Next talk to watch →
            </button>
          </div>
        </div>
      </section>

      <section className={`panel ${styles.board}`}>
        {fieldNav}
        <div className={styles.desktopOnly}>
          <TreeCanvas {...shared} focus={focus} />
        </div>
        <div className={styles.mobileOnly}>
          <TreeList {...shared} />
        </div>
        <div className={styles.legend}>
          {TIERS.map((tier, i) => (
            <span key={tier.level} className={TIER_CLASS[i]}>
              <i className={styles.sw} />
              Tier {tier.numeral} · {tier.name}
            </span>
          ))}
          <span>pulsing = ready · glowing = watched · dim = locked</span>
          <label className={styles.find}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.5 4.5a6 6 0 1 0 0 12a6 6 0 1 0 0-12ZM15 15l5.5 5.5" />
            </svg>
            <span className={styles.srOnly}>Find a talk or speaker</span>
            <input
              type="search"
              placeholder="Find a talk or speaker"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      </section>

      <p className={styles.footnote}>
        Each tree is a hand-picked sample of its field.{" "}
        <a href={`/tracks/${field.track}`}>Browse every {field.name} talk</a>.
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
  goTo: (youtubeId: string) => void;
  /** Search text: matching talks light up, the rest dim. */
  query: string;
  onToggle: (t: PlacedTalk) => void;
  onWatch: (t: PlacedTalk) => void;
};

/* ------------------------------------------------------------------ */
/* Desktop: an infinite canvas with pan, zoom, minimap and search.     */
/* ------------------------------------------------------------------ */

function TreeCanvas({
  field,
  layout,
  status,
  selected,
  setSelected,
  goTo,
  query,
  onToggle,
  onWatch,
  focus,
}: SharedProps & { focus: { id: string; n: number } | null }) {
  const L = LAYOUT;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 0.4 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const moved = useRef(false);

  // Measure the canvas.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(r.width - s.w) > 1 || Math.abs(r.height - s.h) > 1 ? { w: r.width, h: r.height } : s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (!size.w) return;
    const availW = Math.max(300, size.w - 48);
    const availH = Math.max(280, size.h - HEAD - 20);
    const k = clamp(Math.min(availW / layout.width, availH / layout.height), MIN_K, MAX_K);
    setView({ k, x: (size.w - layout.width * k) / 2, y: HEAD + (availH - layout.height * k) / 2 + 6 });
  }, [size.w, size.h, layout]);

  // Start zoomed out on the whole tree, and again on a new field or size.
  useEffect(fit, [fit]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
    });
  }, []);
  const zoomCenter = (factor: number) => zoomAt(factor, size.w / 2, (size.h + HEAD) / 2);

  // Wheel zooms the canvas; over the talk card, search box or map it scrolls that instead.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-stop]")) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const focusOn = useCallback(
    (id: string) => {
      const n = layout.byYoutubeId.get(id);
      if (!n || !size.w) return;
      setView((v) => {
        const k = Math.max(v.k, NAMES_AT + 0.2);
        // Leave room for the talk card on the right.
        const shift = size.w > 900 ? 180 : 0;
        return {
          k,
          x: size.w / 2 - shift - (n.x + L.cardW / 2) * k,
          y: (size.h + HEAD) / 2 - (n.y + L.cardH / 2) * k,
        };
      });
    },
    [layout, size.w, size.h, L.cardW, L.cardH],
  );

  useEffect(() => {
    if (focus) focusOn(focus.id);
    // Only a new request moves the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as Element).closest("[data-stop]")) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!moved.current && Math.abs(dx) + Math.abs(dy) < 5) return;
    moved.current = true;
    setDragging(true);
    setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const k = view.k;
  const near = k >= NAMES_AT;
  const q = query.trim().toLowerCase();

  const statuses = useMemo(() => new Map(layout.talks.map((t) => [t.youtubeId, status(t)])), [layout, status]);

  const edges = useMemo(() => {
    const r = near ? 0 : 33;
    const outPt = (n: PlacedTalk) => [near ? n.x + L.cardW : n.x + L.cardW / 2 + r, n.y + L.cardH / 2];
    const inPt = (n: PlacedTalk) => [near ? n.x : n.x + L.cardW / 2 - r, n.y + L.cardH / 2];
    const hubOut = L.hubX + L.hubW;
    let done = "";
    let open = "";
    let locked = "";
    let root = "";
    for (const n of layout.talks) {
      const [bx, by] = inPt(n);
      const own = statuses.get(n.youtubeId) === "watched";
      if (n.parents.length === 0) {
        const d = curve(hubOut, layout.branches[n.branchIndex].centerY, bx, by);
        if (own) done += d;
        else open += d;
        continue;
      }
      for (const p of n.parents) {
        const pn = layout.byYoutubeId.get(p);
        if (!pn) continue;
        const [ax, ay] = outPt(pn);
        const d = curve(ax, ay, bx, by);
        const lit = statuses.get(p) === "watched";
        if (lit && own) done += d;
        else if (lit) open += d;
        else locked += d;
      }
    }
    for (const b of layout.branches) root += curve(L.rootX + L.rootW, layout.rootY, L.hubX, b.centerY);
    return { done, open, locked, root };
  }, [layout, statuses, near, L]);

  const labelFont = clamp(11.5 / k, 12, 28);
  const mini = useMemo(() => {
    const s = Math.min(MINI_W / layout.width, MINI_H / layout.height);
    return { s, ox: (MINI_W - layout.width * s) / 2, oy: (MINI_H - layout.height * s) / 2 };
  }, [layout]);

  const onMini = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const m = e.currentTarget.getBoundingClientRect();
    const wx = (e.clientX - m.left - mini.ox) / mini.s;
    const wy = (e.clientY - m.top - mini.oy) / mini.s;
    setView((v) => ({ ...v, x: size.w / 2 - wx * v.k, y: (size.h + HEAD) / 2 - wy * v.k }));
  };

  const sel = selected ? layout.byYoutubeId.get(selected) : undefined;
  const bg = Math.max(8, Math.round(26 * k));

  return (
    <div
      ref={ref}
      className={styles.canvas}
      data-dragging={dragging ? "true" : undefined}
      style={{ backgroundPosition: `${Math.round(view.x)}px ${Math.round(view.y)}px`, backgroundSize: `${bg}px ${bg}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div
        className={`${styles.world} ${near ? "" : styles.far}`}
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${k})`,
        }}
      >
        {layout.tierX.map((x, t) => (
          <div
            key={t}
            className={styles.band}
            style={{
              left: x - 80,
              width: L.cardW + 160,
              height: layout.height,
              background: `linear-gradient(90deg, transparent, ${TIER_GLOW[t]} 25%, ${TIER_GLOW[t]} 75%, transparent)`,
            }}
          />
        ))}
        {layout.branches.slice(1).map((b) => (
          <div key={b.index} className={styles.lane} style={{ left: L.hubX - 30, top: b.y - 8, width: layout.width - L.hubX }} />
        ))}
        <svg
          className={styles.edges}
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden="true"
        >
          <path className={styles.edgeLocked} d={edges.locked} />
          <path className={styles.edgeRoot} d={edges.root} />
          <path className={styles.edgeOpen} d={edges.open} />
          <path className={styles.edgeDone} d={edges.done} />
        </svg>

        <div
          className={styles.root}
          style={{ left: L.rootX, top: layout.rootY - L.rootH / 2, width: L.rootW, height: L.rootH }}
          aria-hidden="true"
        >
          <div className={styles.rootIn} style={{ fontSize: clamp(12 / k, 14, 34) }}>
            <TalkIcon name={FIELD_ICON[field.slug]} className={styles.rootIcon} />
            <span>{field.name}</span>
          </div>
        </div>

        {layout.branches.map((b) => {
          const done = b.talks.filter((t) => statuses.get(t.youtubeId) === "watched").length;
          return (
            <div
              key={b.index}
              className={styles.hub}
              data-full={done === b.talks.length ? "true" : undefined}
              style={{ left: L.hubX, top: b.centerY, width: L.hubW, fontSize: labelFont }}
            >
              <div className={styles.ring}>
                <svg viewBox="0 0 64 64" aria-hidden="true">
                  <circle className={styles.ringTrack} cx="32" cy="32" r="28" />
                  {done > 0 ? (
                    <circle
                      className={styles.ringFill}
                      cx="32"
                      cy="32"
                      r="28"
                      strokeDasharray={`${(RING * done) / b.talks.length} ${RING}`}
                      transform="rotate(-90 32 32)"
                    />
                  ) : null}
                </svg>
                <TalkIcon name={branchIcon(b)} className={styles.ringIcon} />
              </div>
              <div className={styles.hubName}>
                {b.name}
                <small>
                  {done}/{b.talks.length} watched
                </small>
              </div>
            </div>
          );
        })}

        {layout.talks.map((t) => {
          const st = statuses.get(t.youtubeId) ?? "locked";
          const tier = TIER_INDEX[t.tier];
          const hit = q ? t.title.toLowerCase().includes(q) || t.speakers.some((s) => s.toLowerCase().includes(q)) : null;
          return (
            <button
              key={t.key}
              type="button"
              className={styles.node}
              data-status={st}
              data-selected={selected === t.youtubeId ? "true" : undefined}
              data-match={hit === null ? undefined : String(hit)}
              style={{ left: t.x, top: t.y, color: st === "locked" ? LOCKED_COLOR : TIER_COLOR[tier] }}
              aria-label={`${t.title}, Tier ${TIERS[tier].numeral} ${TIERS[tier].name}, ${st}`}
              title={near ? undefined : t.title}
              onClick={() => {
                if (moved.current) {
                  moved.current = false;
                  return;
                }
                setSelected(t.youtubeId);
              }}
            >
              <span className={styles.hex}>
                <span className={styles.hexIn}>
                  <TalkIcon name={t.icon} className={styles.hexIcon} />
                </span>
              </span>
              <span className={styles.nodeText}>
                <span className={styles.cardTitle}>{t.title}</span>
                <span className={styles.cardMeta}>
                  {t.speakers.length ? `${t.speakers.join(", ")} · ` : ""}
                  {minutes(t.durationSeconds)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.tiers} aria-hidden="true">
        {TIERS.map((tier, t) => (
          <div
            key={tier.level}
            className={styles.tierHead}
            style={{ left: Math.round(view.x + (layout.tierX[t] + L.cardW / 2) * k), color: TIER_COLOR[t] }}
          >
            <b>TIER {tier.numeral}</b>
            <span>{tier.name}</span>
            <i />
          </div>
        ))}
      </div>
      <div className={styles.canvasHead}>
        <p className={styles.eyebrow}>{field.blurb}</p>
        <h2>{field.name}</h2>
      </div>


      <div className={styles.zoomLevel}>{Math.round(k * 100)}%</div>
      <div className={styles.controls} data-stop="1">
        <button type="button" aria-label="Zoom in" onClick={() => zoomCenter(1.25)}>
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomCenter(0.8)}>
          −
        </button>
        <button type="button" aria-label="Fit whole tree" onClick={fit}>
          FIT
        </button>
      </div>
      <div className={styles.hint}>{near ? "Drag to pan · scroll to zoom" : "Scroll or press + to zoom in and read talk names"}</div>

      <div
        className={styles.minimap}
        data-stop="1"
        role="img"
        aria-label="Mini map of the whole tree. Click to jump there."
        onPointerDown={onMini}
      >
        {layout.branches.map((b) => (
          <span
            key={b.index}
            className={styles.miniHub}
            style={{
              left: mini.ox + L.hubX * mini.s,
              top: mini.oy + (b.centerY - L.ringW / 2) * mini.s,
              width: L.ringW * mini.s,
              height: L.ringW * mini.s,
            }}
          />
        ))}
        {layout.talks.map((t) => {
          const st = statuses.get(t.youtubeId);
          return (
            <span
              key={t.key}
              style={{
                left: mini.ox + t.x * mini.s,
                top: mini.oy + t.y * mini.s,
                width: Math.max(2, L.cardW * mini.s),
                height: Math.max(2, L.cardH * mini.s),
                background: st === "locked" ? "rgba(125,255,106,.5)" : TIER_COLOR[TIER_INDEX[t.tier]],
                opacity: st === "watched" ? 1 : st === "ready" ? 0.55 : 0.35,
              }}
            />
          );
        })}
        <span
          className={styles.miniView}
          style={{
            left: mini.ox - (view.x / k) * mini.s,
            top: mini.oy - (view.y / k) * mini.s,
            width: (size.w / k) * mini.s,
            height: (size.h / k) * mini.s,
          }}
        />
        <span className={styles.miniLabel}>Map</span>
      </div>

      {sel ? (
        <aside className={styles.panelCard} data-stop="1" aria-live="polite">
          <TalkDetails
            key={sel.youtubeId}
            talk={sel}
            layout={layout}
            status={status}
            onClose={() => setSelected(null)}
            onSelect={goTo}
            onToggle={onToggle}
            onWatch={onWatch}
          />
        </aside>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phones: the same tree as a list, grouped by branch then tier.       */
/* ------------------------------------------------------------------ */

function TreeList({ layout, status, selected, setSelected, query, onToggle, onWatch }: SharedProps) {
  const q = query.trim().toLowerCase();
  const refs = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    if (!selected) return;
    const el = refs.current.get(selected);
    if (el && el.offsetParent !== null) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  return (
    <div className={styles.list}>
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
              const talks = b.talks.filter(
                (t) =>
                  TIER_INDEX[t.tier] === i &&
                  (!q || t.title.toLowerCase().includes(q) || t.speakers.some((s) => s.toLowerCase().includes(q))),
              );
              if (talks.length === 0) return null;
              return (
                <div key={tier.level} className={`${styles.listTier} ${TIER_CLASS[i]}`}>
                  <p className={styles.listTierName}>
                    Tier {tier.numeral} · {tier.name}
                  </p>
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

function StatusGem({ status, numeral }: { status: TalkStatus; numeral: string }) {
  return (
    <span className={styles.gem} data-status={status} aria-hidden="true">
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
  const [toast, setToast] = useState("");
  const st = status(talk);
  const tierIndex = TIER_INDEX[talk.tier];
  const tier = TIERS[tierIndex];
  const parents = talk.parents.map((id) => layout.byYoutubeId.get(id)).filter((t): t is PlacedTalk => Boolean(t));
  const unlocks = layout.talks.filter((t) => t.parents.includes(talk.youtubeId));
  const branch = layout.branches[talk.branchIndex];

  function toggle() {
    if (st === "watched") {
      setToast("");
    } else {
      const opened = unlocks.filter((u) => status(u) === "locked").length;
      setToast(
        `+${minutes(talk.durationSeconds)} watched` +
          (opened ? ` · opened ${opened} talk${opened > 1 ? "s" : ""}` : ""),
      );
    }
    onToggle(talk);
  }

  return (
    <div className={styles.details}>
      <div className={styles.detailHead}>
        <span className={styles.statLabel}>
          {st === "watched" ? "Watched" : st === "ready" ? "Ready to watch" : "Locked"}
        </span>
        {onClose ? (
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close talk card">
            ×
          </button>
        ) : null}
      </div>
      <div className={styles.thumb}>
        <img
          src={thumbnailSrc(talk.youtubeId, "mq")}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
        <span className={styles.play} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8 5v14l11-7Z" />
          </svg>
        </span>
        {talk.durationSeconds ? <span className={styles.thumbDur}>{formatDuration(talk.durationSeconds)}</span> : null}
        {st === "locked" ? (
          <span className={styles.lockOver}>
            Locked
            <br />
            Watch a talk that leads here to open it
          </span>
        ) : null}
      </div>
      <p className={styles.chips}>
        <span className={styles.tierChip} style={{ color: TIER_COLOR[tierIndex] }}>
          Tier {tier.numeral} · {tier.name}
        </span>
        <span>{branch.name}</span>
        {talk.event ? <span>{talk.event}</span> : null}
      </p>
      <h3 className={styles.detailTitle}>{talk.title}</h3>
      {talk.speakers.length ? (
        <div>
          <p className={styles.statLabel}>Speakers</p>
          <p className={styles.detailText}>{talk.speakers.join(", ")}</p>
        </div>
      ) : null}
      {talk.teaser ? <p className={styles.detailText}>{talk.teaser}</p> : null}
      <div className={styles.req}>
        <p className={styles.statLabel}>Unlocked by</p>
        {parents.length === 0 ? <div>Open from the start (first talk in this branch)</div> : null}
        {parents.map((p) => (
          <button key={p.youtubeId} type="button" onClick={() => onSelect(p.youtubeId)}>
            {status(p) === "watched" ? "✓" : "○"} {p.title}
          </button>
        ))}
      </div>
      {unlocks.length ? (
        <div className={styles.req}>
          <p className={styles.statLabel}>Leads to</p>
          {unlocks.map((u) => (
            <button key={u.youtubeId} type="button" onClick={() => onSelect(u.youtubeId)}>
              → {u.title}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.actions}>
        <Link href={`/talks/${talk.slug}`} className={styles.btn}>
          Open talk
        </Link>
        <a
          href={`https://www.youtube.com/watch?v=${talk.youtubeId}`}
          target="_blank"
          rel="noreferrer"
          className={`${styles.btn} ${styles.btnAlt}`}
          onClick={() => onWatch(talk)}
        >
          YouTube ↗
        </a>
        <button type="button" className={`${styles.btn} ${styles.btnAlt}`} onClick={toggle} disabled={st === "locked"}>
          {st === "watched" ? "Mark unwatched" : "Mark watched"}
        </button>
      </div>
      <p className={styles.toast} aria-live="polite">
        {toast}
      </p>
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
