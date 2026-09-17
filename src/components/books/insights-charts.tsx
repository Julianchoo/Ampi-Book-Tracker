"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { RangeToggle } from "@/components/books/reading-stats";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type {
  DecadeBar,
  GenreBubble,
  Insights,
  RatingBar,
} from "@/lib/insights";
import { cn } from "@/lib/utils";

/*
 * One hue, like the reading map: every mark is --primary at some strength and
 * identity comes from direct labels, not from a colour key. The chart-N tokens
 * are five rusts that fail colour-vision separation, and --star gold is
 * reserved for the user's own star ratings, so neither belongs here.
 *
 * Dashed = still on the wishlist, everywhere — the same language the map uses.
 */

/** Below this many rated books a decade's average is noise, so its bar recedes. */
const THIN_DECADE = 3;
/** Bubble area in px², mapped from books read (so radius grows as √books). */
const BUBBLE_AREA = [90, 760] as const;
/** At most this many genre names are drawn on the chart itself (fewer on a phone). */
const LABEL_LIMIT = 6;
const LABEL_LIMIT_NARROW = 3;
/** Everything that isn't the selection fades to this, as on the map. */
const DIM = 0.35;

const barConfig = {
  books: { label: "Books", color: "var(--primary)" },
} satisfies ChartConfig;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * False until mounted, so the server renders the roomy, animated default and
 * only the browser narrows it — no hydration mismatch either way.
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function TooltipCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {children}
    </div>
  );
}

/** The map's book dot: filled for read, dashed outline for wishlist. */
function BookDot({ pending }: { pending: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 shrink-0">
      {pending ? (
        <circle
          cx="5"
          cy="5"
          r="3.75"
          className="fill-card stroke-primary"
          strokeWidth="1.3"
          strokeDasharray="2 1.5"
        />
      ) : (
        <circle cx="5" cy="5" r="4" className="fill-primary" />
      )}
    </svg>
  );
}

function ChartCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="animate-fade-up min-w-0 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <h2 id={`${id}-heading`} className="font-display text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
        {description}
      </p>
      {children}
    </section>
  );
}

/** The same numbers, reachable by keyboard and screen reader. */
function TableDetails({
  summary,
  head,
  children,
}: {
  summary: string;
  head: string[];
  children: React.ReactNode;
}) {
  return (
    <details className="mt-3 border-t pt-2 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        {summary}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              {head.map((h) => (
                <th key={h} scope="col" className="py-1 pr-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </details>
  );
}

export function InsightsCharts({
  all,
  thisYear,
}: {
  all: Insights;
  thisYear: Insights;
}) {
  const [yearOnly, setYearOnly] = React.useState(false);
  const [genreId, setGenreId] = React.useState<string | null>(null);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const data = yearOnly ? thisYear : all;

  // Derived rather than stored: switching range can drop a genre entirely, and
  // a stale selection would open a panel for something that isn't on screen.
  const selected = React.useMemo(() => {
    if (!genreId) return null;
    const bubble = data.bubbles.find((b) => b.id === genreId);
    const waiting = data.pendingGenres.find((p) => p.id === genreId);
    if (!bubble && !waiting) return null;
    return {
      id: genreId,
      label: bubble?.label ?? waiting?.label ?? genreId,
      read: bubble?.read ?? 0,
      pending: bubble?.pending ?? waiting?.pending ?? 0,
      avgRating: bubble?.avgRating ?? null,
      books: data.booksByGenre[genreId] ?? [],
    };
  }, [genreId, data]);

  const toggleGenre = (id: string) =>
    setGenreId((current) => (current === id ? null : id));

  const empty =
    data.decades.length === 0 &&
    data.bubbles.length === 0 &&
    data.ratings.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {plural(data.counts.read, "book")} read
          {data.counts.pending > 0 && ` · ${data.counts.pending} waiting`}
        </p>
        <RangeToggle year={data.year} value={yearOnly} onChange={setYearOnly} />
      </div>

      {empty ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing finished in {data.year} yet — switch to All time to see the
          whole shelf.
        </p>
      ) : (
        <>
          {data.decades.length > 0 && (
            <ErasCard
              decades={data.decades}
              note={data.decadesNote}
              animate={!reduced}
            />
          )}

          {data.bubbles.length + data.pendingGenres.length > 0 && (
            <GenresCard
              data={data}
              yearOnly={yearOnly}
              selected={selected}
              onSelect={toggleGenre}
              onClear={() => setGenreId(null)}
              animate={!reduced}
            />
          )}

          {data.ratings.length > 0 && (
            <RatingsCard
              ratings={data.ratings}
              avgRating={data.avgRating}
              note={data.ratingsNote}
              animate={!reduced}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ eras -- */

function decadeTip(d: DecadeBar): string {
  const avg = d.rated > 0 ? ` · avg ${d.avgRating?.toFixed(1)}` : "";
  return `${plural(d.books, "book")}${avg}`;
}

function ErasCard({
  decades,
  note,
  animate,
}: {
  decades: DecadeBar[];
  note: string | null;
  animate: boolean;
}) {
  const thin = decades.some((d) => d.rated < THIN_DECADE);

  return (
    <ChartCard
      id="eras"
      title="The eras you read"
      description="When the books on your shelf were first published."
    >
      <ChartContainer config={barConfig} className="mt-3 h-[220px] w-full sm:h-[260px]">
        <BarChart
          accessibilityLayer
          data={decades}
          margin={{ top: 8, right: 8, bottom: 0, left: -14 }}
        >
          <CartesianGrid vertical={false} strokeOpacity={0.4} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={38}
            fontSize={11}
          />
          <ChartTooltip
            cursor={{ fillOpacity: 0.08 }}
            content={({ active, payload }) => {
              const d = active ? payload?.[0]?.payload : undefined;
              if (!d) return null;
              const decade = d as DecadeBar;
              return (
                <TooltipCard>
                  <span className="font-medium">{decade.label}</span>
                  <span className="text-muted-foreground"> — {decadeTip(decade)}</span>
                </TooltipCard>
              );
            }}
          />
          <Bar
            dataKey="books"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            isAnimationActive={animate}
          >
            {/* A decade held up by one rated book shouldn't pull the eye as
                hard as one held up by twenty. */}
            {decades.map((d) => (
              <Cell
                key={d.decade}
                fill="var(--color-books)"
                fillOpacity={d.rated < THIN_DECADE ? 0.35 : 0.9}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
      {thin && (
        <p className="mt-1 text-xs text-muted-foreground">
          Paler bars have fewer than {THIN_DECADE} rated books.
        </p>
      )}

      <TableDetails
        summary="View as a table"
        head={["Decade", "Books", "Rated", "Avg rating"]}
      >
        {decades.map((d) => (
          <tr key={d.decade} className="border-t">
            <td className="py-1 pr-4">{d.label}</td>
            <td className="py-1 pr-4 tabular-nums">{d.books}</td>
            <td className="py-1 pr-4 tabular-nums">{d.rated}</td>
            <td className="py-1 pr-4 tabular-nums">
              {d.avgRating != null ? d.avgRating.toFixed(1) : "—"}
            </td>
          </tr>
        ))}
      </TableDetails>
    </ChartCard>
  );
}

/* ---------------------------------------------------------------- genres -- */

type SelectedGenre = {
  id: string;
  label: string;
  read: number;
  pending: number;
  avgRating: number | null;
  books: { id: string; title: string; author: string | null; rating: number | null; pending: boolean }[];
};

type BubblePoint = {
  cx?: number;
  cy?: number;
  /** Symbol area in px², already scaled by the ZAxis. */
  size?: number;
  payload?: GenreBubble;
};

function GenresCard({
  data,
  yearOnly,
  selected,
  onSelect,
  onClear,
  animate,
}: {
  data: Insights;
  yearOnly: boolean;
  selected: SelectedGenre | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  animate: boolean;
}) {
  const { bubbles, pendingGenres, ratingDomain, avgRating } = data;
  const [hovered, setHovered] = React.useState<string | null>(null);
  // A phone has room for about three genre names before they start colliding.
  const narrow = useMediaQuery("(max-width: 639px)");

  const maxRead = Math.max(...bubbles.map((b) => b.read), 1);
  const [lo, hi] = ratingDomain;
  const midRating = (lo + hi) / 2;

  /*
   * Bubbles are laid out on y by books read rather than crowded onto one row:
   * with seventeen genres inside a two-point rating span a single band overlaps
   * badly, while stacking by count keeps the big genres apart at the top. Size
   * repeats `read` on purpose — the repetition is what stops a bubble
   * swallowing its neighbour, and the y-axis makes the size legible as a number.
   *
   * The y-scale is square-rooted (and its ticks are drawn, so nothing is
   * hidden): one parent genre usually holds half the shelf, and on a linear
   * axis it would push every two- and three-book genre into one stripe along
   * the bottom.
   */
  const readTicks = React.useMemo(() => {
    const ticks = [0, 1, 2, 3, 5, 10, 20, 40, 80].filter((t) => t < maxRead);
    return [...ticks, maxRead];
  }, [maxRead]);

  const labelled = React.useMemo(() => {
    const gap = (hi - lo) / (narrow ? 2 : 3);
    const picked: GenreBubble[] = [];
    for (const b of [...bubbles].sort((x, y) => y.read - x.read)) {
      if (picked.length >= (narrow ? LABEL_LIMIT_NARROW : LABEL_LIMIT)) break;
      // Labels sit beside the bubble at its own height, so two only collide
      // when they sit on neighbouring rows and close along x.
      const collides = picked.some(
        (p) =>
          Math.abs(p.read - b.read) <= 1 &&
          Math.abs(p.avgRating - b.avgRating) < gap
      );
      if (!collides) picked.push(b);
    }
    return new Set(picked.map((b) => b.id));
  }, [bubbles, lo, hi, narrow]);

  // Only a bubble's own selection dims the chart; picking a "not started yet"
  // pill has nothing to highlight here, so the plot stays as it was.
  const focused = bubbles.some((b) => b.id === selected?.id) ? selected?.id : null;

  const renderBubble = (props: unknown) => {
    const { cx, cy, size, payload } = props as BubblePoint;
    if (cx == null || cy == null || !payload) return <g />;
    const r = Math.sqrt(Math.max(size ?? 0, 1) / Math.PI);
    // The dashed ring is area-true: read + pending books, same scale as the fill.
    const ring = r * Math.sqrt((payload.read + payload.pending) / payload.read) + 2;
    const isSelected = focused === payload.id;
    const active = isSelected || hovered === payload.id;
    const dim = focused && !isSelected ? DIM : 1;
    const left = payload.avgRating > midRating;

    return (
      <g
        opacity={dim}
        className="cursor-pointer transition-opacity duration-300"
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setHovered(payload.id);
        }}
        onPointerLeave={() => setHovered(null)}
      >
        {/* Classes rather than attributes: dark mode needs a touch more fill
            for the same presence against the dark card. */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          strokeWidth={1.5}
          className={
            active
              ? "fill-primary/40 stroke-primary dark:fill-primary/50"
              : "fill-primary/22 stroke-primary/70 dark:fill-primary/32"
          }
        />
        {payload.pending > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={ring}
            fill="none"
            strokeWidth={1.25}
            strokeDasharray="4 3"
            className="stroke-primary/60 dark:stroke-primary/80"
          />
        )}
        {isSelected && (
          <circle
            cx={cx}
            cy={cy}
            r={ring + 4}
            fill="none"
            strokeWidth={1.75}
            className="stroke-primary"
          />
        )}
        {/* Once a genre is picked the other names step back with their
            bubbles; only the live one keeps its label. */}
        {(active || (labelled.has(payload.id) && !focused)) && (
          // A card-coloured halo behind the text, as on the reading map, so a
          // name stays readable where it crosses a bubble.
          <text
            x={left ? cx - ring - 5 : cx + ring + 5}
            y={cy}
            textAnchor={left ? "end" : "start"}
            dominantBaseline="middle"
            fontSize={11}
            className="pointer-events-none fill-foreground stroke-card font-medium"
            paintOrder="stroke"
            strokeWidth={3}
            strokeLinejoin="round"
          >
            {payload.label}
          </text>
        )}
      </g>
    );
  };

  return (
    <ChartCard
      id="genres"
      title="How your genres compare"
      description="Across: what you rate them. Up: how many you've read. The dashed ring is what's still on your wishlist."
    >
      {bubbles.length > 0 && (
        <>
          <ChartContainer
            config={barConfig}
            /* Clicking a bubble focuses recharts' own z-index layer, and the
             * global outline token then draws a box around the whole plot;
             * that layer's class is generated, so it is matched by tabindex. */
            className={cn(
              "mt-3 h-[340px] w-full sm:h-[400px]",
              "[&_[tabindex='-1']]:outline-hidden"
            )}
          >
            <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: -14 }}>
              <CartesianGrid strokeOpacity={0.35} />
              <XAxis
                type="number"
                dataKey="avgRating"
                domain={ratingDomain}
                tickCount={5}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                fontSize={11}
                tickFormatter={(v: number) => v.toFixed(1)}
                label={{
                  value: "Your average rating",
                  position: "insideBottom",
                  offset: -12,
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                }}
              />
              <YAxis
                type="number"
                dataKey="read"
                scale="sqrt"
                // Headroom above the biggest genre, so the top bubble clears
                // the average's label instead of kissing the ceiling.
                domain={[0, maxRead * 1.4]}
                ticks={readTicks}
                tickLine={false}
                axisLine={false}
                width={38}
                fontSize={11}
              />
              <ZAxis
                type="number"
                dataKey="read"
                range={[BUBBLE_AREA[0], BUBBLE_AREA[1]]}
              />
              {/* The axis is fitted to the real spread, which would let a
                  half-point gap look like a chasm — the average says where
                  the middle actually is. */}
              {avgRating != null && (
                <ReferenceLine
                  x={avgRating}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  label={{
                    value: `your average ${avgRating.toFixed(1)}`,
                    position: "top",
                    fontSize: 10,
                    fill: "var(--muted-foreground)",
                  }}
                />
              )}
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  const d = active ? payload?.[0]?.payload : undefined;
                  if (!d) return null;
                  const g = d as GenreBubble;
                  return (
                    <TooltipCard>
                      <span className="font-medium">{g.label}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {g.read} read · avg {g.avgRating.toFixed(1)}
                        {g.pending > 0 && ` · ${g.pending} on wishlist`}
                      </span>
                    </TooltipCard>
                  );
                }}
              />
              <Scatter
                data={bubbles}
                shape={renderBubble}
                isAnimationActive={animate}
                onClick={(point: unknown) => {
                  // Recharts hands over the point node on some versions and the
                  // datum on others; both carry the genre.
                  const node = point as { id?: string; payload?: { id?: string } };
                  const id = node.id ?? node.payload?.id;
                  if (id) onSelect(id);
                }}
              />
            </ScatterChart>
          </ChartContainer>

          <p className="mt-1 text-xs text-muted-foreground">
            Genres with at least two books read; the height axis is
            square-rooted so the small ones stay apart. Tap a bubble for its
            books.
            {yearOnly && ` Wishlist counts cover your whole shelf, not just ${data.year}.`}
          </p>
        </>
      )}

      {pendingGenres.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Not started yet
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pendingGenres.map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={selected?.id === g.id}
                onClick={() => onSelect(g.id)}
                className={cn(
                  "rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  selected?.id === g.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary/50 text-primary hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {g.label}
                <span
                  className={cn(
                    "ml-1 tabular-nums",
                    selected?.id === g.id
                      ? "text-primary-foreground/75"
                      : "text-muted-foreground"
                  )}
                >
                  {g.pending} waiting
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && <GenrePanel genre={selected} onClear={onClear} />}

      {bubbles.length > 0 && (
        <TableDetails
          summary="View as a table"
          head={["Genre", "Read", "Avg rating", "On wishlist", ""]}
        >
          {bubbles.map((b) => (
            <tr key={b.id} className="border-t">
              <td className="py-1 pr-4">{b.label}</td>
              <td className="py-1 pr-4 tabular-nums">{b.read}</td>
              <td className="py-1 pr-4 tabular-nums">{b.avgRating.toFixed(1)}</td>
              <td className="py-1 pr-4 tabular-nums">{b.pending}</td>
              <td className="py-1">
                <button
                  type="button"
                  onClick={() => onSelect(b.id)}
                  className="rounded-sm text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  Show books
                  <span className="sr-only"> in {b.label}</span>
                </button>
              </td>
            </tr>
          ))}
        </TableDetails>
      )}
    </ChartCard>
  );
}

function GenrePanel({
  genre,
  onClear,
}: {
  genre: SelectedGenre;
  onClear: () => void;
}) {
  return (
    <div className="animate-fade-up mt-4 rounded-lg border bg-muted/50 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">{genre.label}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {plural(genre.read, "book")} read
            {genre.avgRating != null && ` · avg ${genre.avgRating.toFixed(1)}`}
            {genre.pending > 0 && ` · ${genre.pending} on wishlist`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label={`Close ${genre.label}`}
          className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X className="size-4" />
        </button>
      </div>

      {genre.books.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing read here yet.
        </p>
      ) : (
        // A big genre can hold forty books; the list scrolls rather than
        // pushing the rest of the page out of reach.
        <ul className="mt-2 -mx-2 max-h-80 space-y-0.5 overflow-y-auto">
          {genre.books.map((b) => (
            <li key={b.id}>
              <Link
                href={`/books/${b.id}`}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/50 hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <BookDot pending={b.pending} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{b.title}</span>
                  {b.author && (
                    <span className="text-muted-foreground"> — {b.author}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {b.pending ? "wishlist" : b.rating != null ? `${b.rating}/10` : "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- ratings -- */

function RatingsCard({
  ratings,
  avgRating,
  note,
  animate,
}: {
  ratings: RatingBar[];
  avgRating: number | null;
  note: string | null;
  animate: boolean;
}) {
  // buildInsights already fills every half-step between the lowest and highest
  // rating given, so a score nobody used is an empty column, not a hidden gap.
  const values = ratings.map((r) => r.rating);
  const lo = values[0] ?? 0;
  const hi = values[values.length - 1] ?? 10;

  return (
    <ChartCard
      id="ratings"
      title="How you rate"
      description="Every score you've given, in half-point steps."
    >
      <ChartContainer config={barConfig} className="mt-3 h-[200px] w-full sm:h-[240px]">
        <BarChart
          accessibilityLayer
          data={ratings}
          margin={{ top: 16, right: 12, bottom: 0, left: -14 }}
        >
          <CartesianGrid vertical={false} strokeOpacity={0.4} />
          {/* Numeric, not categorical: the average lands at 7.1, between two
              bars, and only a real scale can put the line there. */}
          <XAxis
            type="number"
            dataKey="rating"
            domain={[lo - 0.25, hi + 0.25]}
            ticks={values}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
            tickFormatter={(v: number) => (Number.isInteger(v) ? String(v) : "")}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={38}
            fontSize={11}
          />
          <ChartTooltip
            cursor={{ fillOpacity: 0.08 }}
            content={({ active, payload }) => {
              const d = active ? payload?.[0]?.payload : undefined;
              if (!d) return null;
              const bar = d as RatingBar;
              return (
                <TooltipCard>
                  <span className="font-medium">{bar.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {plural(bar.books, "book")}
                  </span>
                </TooltipCard>
              );
            }}
          />
          {avgRating != null && (
            <ReferenceLine
              x={avgRating}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.8}
              label={{
                value: `average ${avgRating.toFixed(1)}`,
                position: "top",
                fontSize: 10,
                fill: "var(--muted-foreground)",
              }}
            />
          )}
          <Bar
            dataKey="books"
            fill="var(--color-books)"
            fillOpacity={0.85}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
            isAnimationActive={animate}
          />
        </BarChart>
      </ChartContainer>

      {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}

      <TableDetails summary="View as a table" head={["Rating", "Books"]}>
        {ratings.map((r) => (
          <tr key={r.rating} className="border-t">
            <td className="py-1 pr-4 tabular-nums">{r.rating.toFixed(1)}</td>
            <td className="py-1 pr-4 tabular-nums">{r.books}</td>
          </tr>
        ))}
      </TableDetails>
    </ChartCard>
  );
}
