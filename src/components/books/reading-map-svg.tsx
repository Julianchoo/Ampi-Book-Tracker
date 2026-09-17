"use client";

import * as React from "react";
import { looksLikeCover } from "@/lib/books";
import type {
  BookNode,
  GenreNode,
  MapLink,
  ReadingMap as ReadingMapData,
} from "@/lib/constellation";
import { cn } from "@/lib/utils";

export type MapSelection = { kind: "genre" | "book"; id: string };

/*
 * One hue on purpose: every mark is --primary at some strength, and identity
 * comes from the direct labels. The chart palette failed colour-vision checks,
 * and a map of twenty genres would need twenty hues anyway.
 *
 * Sizes that should read the same at any zoom (label text, strokes, the
 * smallest dot) are given in screen pixels and converted to viewBox units via
 * `unit` — the number of viewBox units one CSS pixel covers right now.
 */

const DIM_OPACITY = 0.15;
/** Entrance stagger per node, capped so a big map doesn't take ages to draw. */
const STAGGER_MS = 18;
const STAGGER_CAP_MS = 700;
const SPECK_COUNT = 48;
/** Preview crops to the drawn nodes plus this margin (room for labels). */
const PREVIEW_PAD = 36;
/** Full-map covers, in viewBox units (the layout spaces books for this size). */
const COVER_W = 26;
const COVER_H = 39;
/** How much a hovered or selected cover grows. */
const LIFT_SCALE = 1.5;
const WISH_COVER_OPACITY = 0.7;

type Props = {
  map: ReadingMapData;
  mode: "preview" | "full";
  selected: MapSelection | null;
  onSelect?: ((s: MapSelection | null) => void) | undefined;
  /** Default `0 0 ${map.width} ${map.height}`. Zooming passes a smaller box. */
  viewBox?: string | undefined;
  /** Drag: how far the map moved under the pointer, in map units. */
  onPan?: ((dx: number, dy: number) => void) | undefined;
  /** Wheel or pinch: scale by `factor` about a map point, which stays put. */
  onZoomAt?: ((factor: number, x: number, y: number) => void) | undefined;
  className?: string | undefined;
};

/** A pointer has to travel this far before a tap becomes a drag. */
const DRAG_SLOP = 4;
/** Wheel delta → zoom factor; a line-mode wheel step counts as this many px. */
const WHEEL_SENSITIVITY = 0.0015;
const WHEEL_LINE_PX = 16;

type MapPoint = { x: number; y: number };

/**
 * Drag to pan, two fingers or the wheel to zoom.
 *
 * The map itself never moves here: deltas are handed to the caller in map
 * units and come back as a new viewBox, so one camera drives the buttons,
 * the wheel and the fingers alike.
 */
function usePanZoom({
  svgRef,
  enabled,
  unit,
  toMap,
  onPan,
  onZoomAt,
  onDragStart,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  enabled: boolean;
  /** Map units per CSS pixel right now. */
  unit: number;
  toMap: (clientX: number, clientY: number) => MapPoint | null;
  onPan: ((dx: number, dy: number) => void) | undefined;
  onZoomAt: ((factor: number, x: number, y: number) => void) | undefined;
  onDragStart: () => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const pointers = React.useRef(new Map<number, MapPoint>());
  const moved = React.useRef(false);
  // The wheel listener is attached by hand, so it reads the current values
  // through a ref rather than being torn down on every render.
  const latest = React.useRef({ enabled, toMap, onZoomAt });
  React.useEffect(() => {
    latest.current = { enabled, toMap, onZoomAt };
  });

  // React's onWheel is passive, and a passive listener cannot stop the page
  // from scrolling underneath the map.
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      const current = latest.current;
      if (!current.enabled || !current.onZoomAt) return;
      e.preventDefault();
      const point = current.toMap(e.clientX, e.clientY);
      if (!point) return;
      const delta = e.deltaMode === 1 ? e.deltaY * WHEEL_LINE_PX : e.deltaY;
      current.onZoomAt(Math.exp(-delta * WHEEL_SENSITIVITY), point.x, point.y);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [svgRef]);

  /** Midpoint of every pointer on the map, and how far apart they are. */
  const gesture = () => {
    const points = [...pointers.current.values()];
    const mid = points.reduce(
      (acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }),
      { x: 0, y: 0 }
    );
    const [a, b] = points;
    const spread = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
    return { mid, spread, count: points.length };
  };

  const end = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (pointers.current.size === 0) setDragging(false);
  };

  const handlers: React.DOMAttributes<SVGSVGElement> = enabled
    ? {
        onPointerDown: (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          moved.current = false;
        },
        onPointerMove: (e) => {
          if (!pointers.current.has(e.pointerId)) return;
          const before = gesture();
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const after = gesture();
          const dx = after.mid.x - before.mid.x;
          const dy = after.mid.y - before.mid.y;

          // A tap that never travels stays a tap, so nodes remain clickable.
          if (!moved.current && after.count < 2 && Math.hypot(dx, dy) < DRAG_SLOP) {
            return;
          }
          if (!moved.current) {
            moved.current = true;
            setDragging(true);
            onDragStart();
            // Captured only once it is a drag, so a tap keeps its target.
            if (after.count === 1) e.currentTarget.setPointerCapture(e.pointerId);
          }

          if (dx || dy) onPan?.(dx * unit, dy * unit);
          if (after.count >= 2 && before.spread > 0 && after.spread > 0) {
            const point = toMap(after.mid.x, after.mid.y);
            if (point) onZoomAt?.(after.spread / before.spread, point.x, point.y);
          }
        },
        onPointerUp: end,
        onPointerCancel: end,
        onLostPointerCapture: end,
        // A drag must not fall through as a click on whatever was underneath.
        onClickCapture: (e) => {
          if (!moved.current) return;
          e.preventDefault();
          e.stopPropagation();
        },
      }
    : {};

  return { dragging, handlers };
}

/** The home preview is server-rendered, where useLayoutEffect warns. */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/** Screen pixels per viewBox unit at zoom 1, tracked as the svg resizes. */
function useFitScale(
  ref: React.RefObject<SVGSVGElement | null>,
  width: number,
  height: number
): number {
  const [scale, setScale] = React.useState(0.5);
  // Layout effect: measure before first paint so strokes and labels never
  // flash at the placeholder scale.
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width: w, height: h } = el.getBoundingClientRect();
      // preserveAspectRatio="meet": the tighter axis wins.
      if (w > 0 && h > 0) setScale(Math.min(w / width, h / height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, width, height]);
  return scale;
}

/**
 * One check per thumbnail url for the whole session, so reopening the dialog
 * never downloads or decodes again. Resolves true only for an image that
 * decoded and is shaped like a cover (Open Library's blank is 1×1).
 */
const thumbChecks = new Map<string, Promise<boolean>>();

function checkThumb(url: string): Promise<boolean> {
  let check = thumbChecks.get(url);
  if (!check) {
    const img = new Image();
    img.src = url;
    // decode() rejects on a network or format error, so both failures land here.
    check = img
      .decode()
      .then(() => looksLikeCover(img.naturalWidth, img.naturalHeight))
      .catch(() => false);
    thumbChecks.set(url, check);
  }
  return check;
}

/** Thumbnail urls that are ready to draw as covers. Loads nothing until enabled. */
function useReadyThumbs(books: BookNode[], enabled: boolean): ReadonlySet<string> {
  const [ready, setReady] = React.useState<ReadonlySet<string>>(() => new Set());
  React.useEffect(() => {
    if (!enabled) return;
    let live = true;
    // Checks resolve one by one; collect them and commit once per frame so
    // covers still pop in progressively without a re-render per thumbnail.
    let pending: string[] = [];
    let frame = 0;
    const flush = () => {
      frame = 0;
      const batch = pending;
      pending = [];
      setReady((prev) => {
        const fresh = batch.filter((url) => !prev.has(url));
        return fresh.length ? new Set([...prev, ...fresh]) : prev;
      });
    };
    for (const b of books) {
      const url = b.thumb[0];
      if (!url) continue;
      void checkThumb(url).then((ok) => {
        if (!ok || !live) return;
        pending.push(url);
        if (!frame) frame = requestAnimationFrame(flush);
      });
    }
    return () => {
      live = false;
      if (frame) cancelAnimationFrame(frame);
    };
  }, [books, enabled]);
  return ready;
}

/**
 * A book as a small rounded cover centred on (x, y). The shadow sits on a
 * wrapper because SVG filters before clipping — on the image itself the
 * rounded clip would cut the shadow off.
 */
function CoverArt({
  x,
  y,
  scale,
  href,
  wish,
  unit,
  uid,
}: {
  x: number;
  y: number;
  scale: number;
  href: string;
  wish: boolean;
  unit: number;
  uid: string;
}) {
  const w = COVER_W * scale;
  const h = COVER_H * scale;
  const left = x - w / 2;
  const top = y - h / 2;
  const radius = w * 0.12;
  const gap = 2 * unit;
  return (
    <>
      <g filter={`url(#${uid}-${scale > 1 ? "lift" : "shadow"})`}>
        <image
          href={href}
          x={left}
          y={top}
          width={w}
          height={h}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${uid}-cover-clip)`}
          opacity={wish ? WISH_COVER_OPACITY : 1}
        />
      </g>
      {/* Edge, and the hit target: transparent still counts as painted. */}
      <rect
        x={left}
        y={top}
        width={w}
        height={h}
        rx={radius}
        fill="transparent"
        className="stroke-border"
        strokeWidth={unit}
      />
      {wish && (
        <rect
          x={left - gap}
          y={top - gap}
          width={w + 2 * gap}
          height={h + 2 * gap}
          rx={radius + gap}
          fill="none"
          className="stroke-primary"
          strokeWidth={1.25 * unit}
          strokeDasharray={`${3 * unit} ${2 * unit}`}
        />
      )}
    </>
  );
}

/** The selection ring around a cover drawn at `scale`. */
function CoverRing({ x, y, scale, unit }: { x: number; y: number; scale: number; unit: number }) {
  const gap = 4.5 * unit;
  const w = COVER_W * scale + 2 * gap;
  const h = COVER_H * scale + 2 * gap;
  return (
    <rect
      x={x - w / 2}
      y={y - h / 2}
      width={w}
      height={h}
      rx={COVER_W * scale * 0.12 + gap}
      fill="none"
      className="stroke-primary"
      strokeWidth={1.75 * unit}
    />
  );
}

/**
 * Deterministic 0-1 noise, so the specks don't move between renders. Rounded
 * to 3 places: Math.sin's last digits can differ between server and browser,
 * which would be a hydration mismatch.
 */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return Math.round((x - Math.floor(x)) * 1000) / 1000;
}

/** A gentle arc between two points; the bow direction is stable per link. */
function curvePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bow: number
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Perpendicular offset proportional to length: short links stay nearly straight.
  return `M${x1},${y1} Q${mx - dy * bow},${my + dx * bow} ${x2},${y2}`;
}

/** Which nodes and links stay lit for a selection (or hover). */
function highlightFor(
  active: MapSelection | null,
  genres: GenreNode[],
  bookById: Map<string, BookNode>
): { nodes: Set<string>; links: (l: MapLink) => boolean } | null {
  if (!active) return null;
  const nodes = new Set<string>([active.id]);

  if (active.kind === "book") {
    const book = bookById.get(active.id);
    for (const g of book?.genreIds ?? []) nodes.add(g);
    return {
      nodes,
      links: (l) =>
        l.kind === "book" && (l.target === active.id || l.source === active.id),
    };
  }

  // A genre lights its children, and the books of itself and those children.
  for (const g of genres) if (g.parentId === active.id) nodes.add(g.id);
  const genreSet = new Set(nodes);
  for (const b of bookById.values()) {
    if (b.genreIds.some((g) => genreSet.has(g))) nodes.add(b.id);
  }
  return {
    nodes,
    links: (l) =>
      l.kind === "parent"
        ? l.source === active.id
        : (genreSet.has(l.source) && nodes.has(l.target)) ||
          (genreSet.has(l.target) && nodes.has(l.source)),
  };
}

export function ReadingMapSvg({
  map,
  mode,
  selected,
  onSelect,
  viewBox,
  onPan,
  onZoomAt,
  className,
}: Props) {
  const uid = React.useId().replace(/:/g, "");
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = React.useState<MapSelection | null>(null);
  const full = mode === "full";

  // The small preview can't afford empty margins, so it frames just the
  // nodes; the full map keeps the whole canvas so zoom maths stays simple.
  const frame = React.useMemo(() => {
    if (full) return { x: 0, y: 0, w: map.width, h: map.height };
    const nodes = [...map.genres, ...map.books];
    const x0 = Math.min(...nodes.map((n) => n.x - n.r)) - PREVIEW_PAD;
    const y0 = Math.min(...nodes.map((n) => n.y - n.r)) - PREVIEW_PAD;
    const x1 = Math.max(...nodes.map((n) => n.x + n.r)) + PREVIEW_PAD;
    const y1 = Math.max(...nodes.map((n) => n.y + n.r)) + PREVIEW_PAD;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [full, map]);
  const fitScale = useFitScale(svgRef, frame.w, frame.h);

  const { bookById, nodeById } = React.useMemo(() => {
    const bookById = new Map(map.books.map((b) => [b.id, b]));
    const nodeById = new Map<string, GenreNode | BookNode>([
      ...map.genres.map((g) => [g.id, g] as const),
      ...bookById,
    ]);
    return { bookById, nodeById };
  }, [map]);

  // Zoom is drawn as a transform on an inner group (so it can transition),
  // while the svg itself always shows the whole map.
  const zoom = React.useMemo(() => {
    const parts = (viewBox ?? "").split(/[\s,]+/).map(Number);
    const [x = 0, y = 0, w = map.width] = parts;
    const k = w > 0 && Number.isFinite(w) ? map.width / w : 1;
    return { k, tx: -x * k, ty: -y * k };
  }, [viewBox, map.width]);

  const unit = 1 / (fitScale * zoom.k);

  /** Screen point → map point, undoing the svg's own scale and the zoom. */
  const toMap = React.useCallback(
    (clientX: number, clientY: number): MapPoint | null => {
      const ctm = svgRef.current?.getScreenCTM();
      if (!ctm) return null;
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: (p.x - zoom.tx) / zoom.k, y: (p.y - zoom.ty) / zoom.k };
    },
    [zoom]
  );

  const { dragging, handlers } = usePanZoom({
    svgRef,
    enabled: full && Boolean(onPan),
    unit,
    toMap,
    onPan,
    onZoomAt,
    onDragStart: () => setHovered(null),
  });
  // Labels shrink a little on small screens (where the map is drawn small)
  // and grow back as you zoom in.
  const labelScale = Math.min(1, Math.max(0.8, (fitScale * zoom.k) / 0.7));

  const labelled = React.useMemo(
    () => (full ? null : new Set(map.topGenreIds)),
    [full, map.topGenreIds]
  );

  const specks = React.useMemo(
    () =>
      Array.from({ length: SPECK_COUNT }, (_, i) => ({
        x: frame.x + noise(i + 1) * frame.w,
        y: frame.y + noise(i + 101) * frame.h,
        r: 0.6 + noise(i + 201) * 1.4,
        o: 0.08 + noise(i + 301) * 0.18,
      })),
    [frame]
  );

  const active = full ? ((!dragging && hovered) || selected) : null;
  const lit = React.useMemo(
    () => highlightFor(active, map.genres, bookById),
    [active, map.genres, bookById]
  );

  const nodeOpacity = (id: string) => (!lit || lit.nodes.has(id) ? 1 : DIM_OPACITY);

  // Covers are a full-map thing: the home preview stays dots and never
  // downloads a thumbnail.
  const readyThumbs = useReadyThumbs(map.books, full);
  const coverOf = (b: BookNode): string | undefined => {
    const url = full ? b.thumb[0] : undefined;
    return url && readyThumbs.has(url) ? url : undefined;
  };
  // The hovered/selected cover is redrawn larger in a layer above every
  // other book, since SVG stacks by document order.
  const liftedBook = active?.kind === "book" ? bookById.get(active.id) : undefined;
  const liftedCover = liftedBook ? coverOf(liftedBook) : undefined;

  /** Pointer handlers for one node; none at all in preview mode. */
  const interact = (s: MapSelection) =>
    full
      ? {
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onSelect?.(s);
          },
          // Hover previews only for real pointers; touch commits on tap.
          onPointerEnter: (e: React.PointerEvent) => {
            if (e.pointerType === "mouse") setHovered(s);
          },
          onPointerLeave: () => setHovered(null),
        }
      : {};

  const enter = (i: number): React.CSSProperties => ({
    animationDelay: `${Math.min(i * STAGGER_MS, STAGGER_CAP_MS)}ms`,
  });
  const nodeAnim =
    "origin-center animate-scale-in [animation-fill-mode:both] [transform-box:fill-box] motion-reduce:animate-none";
  const coverAnim =
    "origin-center animate-in fade-in-0 zoom-in-50 duration-300 ease-out [transform-box:fill-box] motion-reduce:animate-none";

  return (
    <svg
      ref={svgRef}
      viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      className={cn(
        "block size-full select-none",
        full && onPan && "touch-none cursor-grab",
        dragging && "cursor-grabbing [&_*]:cursor-grabbing",
        className
      )}
      {...handlers}
      onClick={full ? () => onSelect?.(null) : undefined}
    >
      <defs>
        <radialGradient id={`${uid}-sky`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
        {full && (
          <>
            <clipPath id={`${uid}-cover-clip`} clipPathUnits="objectBoundingBox">
              {/* rx/ry differ so the 2:3 box gets round, not oval, corners. */}
              <rect width="1" height="1" rx="0.12" ry="0.08" />
            </clipPath>
            <filter id={`${uid}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0.8" stdDeviation="1" floodColor="#000" floodOpacity="0.3" />
            </filter>
            <filter id={`${uid}-lift`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#000" floodOpacity="0.42" />
            </filter>
          </>
        )}
      </defs>

      {/* Sky: a warm glow and faint specks. They stay put while the map zooms,
          which gives the zoom a little depth. */}
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.w}
        height={frame.h}
        fill={`url(#${uid}-sky)`}
        // Dark mode's accent is a saturated orange; at full strength it muddies.
        className="dark:opacity-40"
      />
      <g className="fill-foreground">
        {specks.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
        ))}
      </g>

      <g
        style={{
          transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.k})`,
          transformOrigin: "0 0",
        }}
        className={dragging ? undefined : "transition-transform duration-500 ease-out motion-reduce:transition-none"}
      >
        {/* Links first so every node sits on top of them. */}
        <g fill="none" className="stroke-primary">
          {map.links.map((l, i) => {
            const a = nodeById.get(l.source);
            const b = nodeById.get(l.target);
            if (!a || !b) return null;
            const parent = l.kind === "parent";
            const on = lit ? lit.links(l) : false;
            const base = parent ? 0.28 : 0.14;
            const bow = (noise(i + 7) > 0.5 ? 1 : -1) * (parent ? 0.08 : 0.14);
            return (
              <path
                key={`${l.source}>${l.target}`}
                d={curvePath(a.x, a.y, b.x, b.y, bow)}
                strokeWidth={(parent ? 1.25 : 0.9) * unit * (on ? 1.6 : 1)}
                strokeLinecap="round"
                opacity={lit ? (on ? (parent ? 0.8 : 0.6) : base * DIM_OPACITY) : base}
                className="transition-opacity duration-300"
              />
            );
          })}
        </g>

        {map.genres.map((g, i) => {
          const isSelected = full && selected?.kind === "genre" && selected.id === g.id;
          const root = g.depth === 0;
          return (
            <g
              key={g.id}
              opacity={nodeOpacity(g.id)}
              className={cn("transition-opacity duration-300", full && "cursor-pointer")}
              {...interact({ kind: "genre", id: g.id })}
            >
              <g className={nodeAnim} style={enter(i)}>
                <circle
                  cx={g.x}
                  cy={g.y}
                  r={g.r * 2}
                  fill={`url(#${uid}-glow)`}
                  className="dark:opacity-60"
                />
                <circle
                  cx={g.x}
                  cy={g.y}
                  r={g.r}
                  className="fill-primary stroke-primary"
                  fillOpacity={root ? 0.2 : 0.1}
                  strokeOpacity={root ? 0.65 : 0.4}
                  strokeWidth={(root ? 1.5 : 1) * unit}
                />
                <circle
                  cx={g.x}
                  cy={g.y}
                  r={Math.max(g.r * (root ? 0.32 : 0.24), 2.5 * unit)}
                  className="fill-primary"
                  opacity={root ? 0.9 : 0.65}
                />
                {isSelected && (
                  <circle
                    cx={g.x}
                    cy={g.y}
                    r={g.r + 5 * unit}
                    fill="none"
                    className="stroke-primary"
                    strokeWidth={2 * unit}
                  />
                )}
                {/* Invisible, generous hit target. */}
                {full && (
                  <circle
                    cx={g.x}
                    cy={g.y}
                    r={Math.max(g.r, 14 * unit)}
                    fill="transparent"
                  />
                )}
              </g>
            </g>
          );
        })}

        {map.books.map((b, i) => {
          const isSelected = full && selected?.kind === "book" && selected.id === b.id;
          const r = Math.max(b.r, 3 * unit);
          const wish = b.shelf === "wishlist";
          const cover = coverOf(b);
          return (
            <g
              key={b.id}
              opacity={nodeOpacity(b.id)}
              className={cn("transition-opacity duration-300", full && "cursor-pointer")}
              {...interact({ kind: "book", id: b.id })}
            >
              <g className={nodeAnim} style={enter(map.genres.length + i)}>
                {cover ? (
                  // The dot grows into its cover once the thumbnail is ready.
                  // Hidden (still hoverable) while its lifted copy is showing.
                  <g
                    className={coverAnim}
                    opacity={liftedCover && liftedBook?.id === b.id ? 0 : 1}
                  >
                    <CoverArt x={b.x} y={b.y} scale={1} href={cover} wish={wish} unit={unit} uid={uid} />
                    {isSelected && <CoverRing x={b.x} y={b.y} scale={1} unit={unit} />}
                  </g>
                ) : (
                  <>
                    {isSelected && (
                      <>
                        <circle cx={b.x} cy={b.y} r={r * 4} fill={`url(#${uid}-glow)`} />
                        <circle
                          cx={b.x}
                          cy={b.y}
                          r={r + 4 * unit}
                          fill="none"
                          className="stroke-primary"
                          strokeWidth={1.75 * unit}
                        />
                      </>
                    )}
                    <circle
                      cx={b.x}
                      cy={b.y}
                      r={r}
                      className={wish ? "fill-card stroke-primary" : "fill-primary stroke-card"}
                      strokeWidth={(wish ? 1.25 : 1) * unit}
                      strokeDasharray={wish ? `${2 * unit} ${1.5 * unit}` : undefined}
                    />
                    {full && (
                      <circle cx={b.x} cy={b.y} r={Math.max(r, 11 * unit)} fill="transparent" />
                    )}
                  </>
                )}
              </g>
            </g>
          );
        })}

        {liftedBook && liftedCover && (
          <g
            key={liftedBook.id}
            opacity={nodeOpacity(liftedBook.id)}
            className="pointer-events-none transition-opacity duration-300"
          >
            <g className="origin-center animate-in duration-200 ease-out zoom-in-67 [transform-box:fill-box] motion-reduce:animate-none">
              <circle
                cx={liftedBook.x}
                cy={liftedBook.y}
                r={COVER_H * LIFT_SCALE}
                fill={`url(#${uid}-glow)`}
              />
              <CoverArt
                x={liftedBook.x}
                y={liftedBook.y}
                scale={LIFT_SCALE}
                href={liftedCover}
                wish={liftedBook.shelf === "wishlist"}
                unit={unit}
                uid={uid}
              />
              {selected?.kind === "book" && selected.id === liftedBook.id && (
                <CoverRing x={liftedBook.x} y={liftedBook.y} scale={LIFT_SCALE} unit={unit} />
              )}
            </g>
          </g>
        )}

        {/* Labels last, above every dot, each with a card-coloured halo so it
            reads across the links in both themes. */}
        <g
          className="pointer-events-none fill-foreground stroke-card"
          paintOrder="stroke"
          strokeLinejoin="round"
          textAnchor="middle"
        >
          {map.genres.map((g, i) => {
            if (labelled && !labelled.has(g.id)) return null;
            const root = g.depth === 0;
            const size = (root ? 14 : 11.5) * labelScale * unit;
            return (
              // Dimming sits on a wrapper: the entrance animation's fill would
              // otherwise pin the text's own opacity at 1.
              <g
                key={g.id}
                opacity={nodeOpacity(g.id)}
                className="transition-opacity duration-300"
              >
                <text
                  x={g.x}
                  y={g.y + g.r + size * 1.15}
                  fontSize={size}
                  strokeWidth={size * 0.32}
                  className={cn(
                    "animate-fade-in [animation-fill-mode:both] motion-reduce:animate-none",
                    root ? "font-display font-semibold" : "font-sans font-medium"
                  )}
                  style={enter(i + 6)}
                >
                  {g.label}
                </text>
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
}
