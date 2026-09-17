# Task 02: Insights page + charts

## Status

complete

## Wave

1

## Description

Builds the `/insights` page: three charts (eras by publication decade, genres as bubbles, own rating distribution), an All time / year toggle, a genre detail panel, and the header nav link. Data and all the maths arrive precomputed from the server (task-01, in parallel) — this task is presentation. The user asked for something lovely to look at, so polish is the acceptance bar.

## Dependencies

**Depends on:** None (Wave 1; parallel to task-01 against the contract below)
**Blocks:** None

**Context from dependencies:** task-01 creates `src/lib/insights.ts` with `buildInsights(books, { range, year })` and `src/lib/queries.ts` with `getInsightsBooks(userId)`. Contract:

```ts
export type DecadeBar = { decade: number; label: string; books: number; rated: number; avgRating: number | null };
export type GenreBubble = { id: string; label: string; read: number; pending: number; rated: number; avgRating: number; topBooks: { id: string; title: string; rating: number | null }[] };
export type PendingGenre = { id: string; label: string; pending: number };
export type RatingBar = { rating: number; books: number };
export type Insights = {
  range: "all" | "year"; year: number;
  decades: DecadeBar[]; decadesNote: string | null;
  bubbles: GenreBubble[]; pendingGenres: PendingGenre[];
  ratingDomain: [number, number]; avgRating: number | null;
  ratings: RatingBar[]; ratingsNote: string | null;
  booksByGenre: Record<string, { id: string; title: string; author: string | null; rating: number | null; pending: boolean }[]>;
  counts: { read: number; pending: number; rated: number };
};
```
Import types with `import type { ... } from "@/lib/insights"` in client files.

## Files to Create

- `src/app/insights/page.tsx` — server page (auth, data, both ranges, metadata)
- `src/components/books/insights-charts.tsx` — client: range toggle + the three charts + genre panel

## Files to Modify

- `src/components/site-header.tsx` — add the Insights nav entry

## Technical Details

**Load the `dataviz` skill and the `frontend-design` skill first** and follow them inside this project's design system: read `DESIGN.md`, `src/app/globals.css`, and `src/components/books/reading-stats.tsx` — it is the model for everything here (recharts with `ChartContainer` + `ResponsiveContainer`, the `RangeToggle` pattern with `aria-pressed`, `StatTile` card styling, `plural()` helpers, chart tooltips). UI copy is English.

Decisions already made (don't revisit):
- **Single hue.** Every mark uses `--primary` at different strengths; no categorical palette (the chart tokens fail colour-vision validation), no colour legend. `--star` gold stays reserved for the user's own star ratings.
- **No dual axes** anywhere.
- Charts are decorative-plus-data: each needs a text equivalent.

### page.tsx

```tsx
export const metadata: Metadata = { title: "Insights" };

export default async function InsightsPage() {
  const session = await requireAuth();
  const books = await getInsightsBooks(session.user.id);
  const year = new Date().getFullYear();
  const all = buildInsights(books, { range: "all", year });
  const thisYear = buildInsights(books, { range: "year", year });
  // both ranges precomputed so the toggle needs no round trip (same trick as the home stats)
  ...
}
```
Layout: `container mx-auto max-w-4xl px-4 py-6 sm:py-8`; header with `h1` "Insights" (`font-display text-3xl font-bold tracking-tight sm:text-4xl`) and a one-line subtitle. If the user has no finished books, render a short empty state with `DachshundReading` (see `src/app/library/page.tsx`) instead of empty charts. Pass `{ all, thisYear }` to the client component.

### insights-charts.tsx

```tsx
"use client";
export function InsightsCharts({ all, thisYear }: { all: Insights; thisYear: Insights })
```
- **Range toggle** at the top right: "All time" / `${year}`, same markup as `RangeToggle` in reading-stats.tsx (two `aria-pressed` buttons). The selected `Insights` object drives all three charts.
- **Three cards**, each `rounded-xl border bg-card shadow-sm` with a heading (`font-display text-lg font-semibold`), a one-line description, the chart, and the caption/note underneath (`text-sm text-muted-foreground`). Hide a card when its dataset is empty.

**1. Eras** — recharts `BarChart` over `decades`.
- x = decade labels ("1940s" … "2020s"), y = books. Bars `fill: var(--primary)`, rounded top, `--primary` at lower opacity for decades with fewer than 3 rated books so the eye is not drawn to single-book bars.
- Tooltip: "2010s — 21 books · avg 7.5" (omit the average when `rated === 0`).
- Under the chart: `decadesNote` when present.

**2. Genres** — recharts `ScatterChart` with `ZAxis` for bubble size.
- x = `avgRating`, domain = `ratingDomain` (NOT 0–10 — the real spread is ~5.6–7.8); label the axis "Your average rating" and add a `ReferenceLine` at `avgRating` labelled "your average" so the fitted axis can't mislead.
- y: a single band (all bubbles on one row) with jitter-free stacking is unreadable at 17 bubbles — instead lay bubbles out on y by `read` (books read) and say so in the axis label, OR keep one row and let the label placement resolve overlaps. Pick whichever reads better with the real data and explain the choice in a comment.
- Bubble size from `read` via `ZAxis range`; fill `var(--primary)` at ~0.25 with a solid stroke.
- **Pending ring**: a dashed circle around the bubble sized for `read + pending` (custom `shape` on `Scatter`), matching the wishlist language used by the reading map. Only when `pending > 0`.
- Direct labels: the genre name next to each bubble where it fits (bigger bubbles always labelled); the rest reachable by hover/tap.
- Tooltip: "Literary — 8 read · avg 7.4 · 2 on wishlist".
- Clicking or tapping a bubble selects it and opens the **genre panel** below the chart: genre name, counts, and the list from `booksByGenre[id]` — read books with their rating (`StarRatingDisplay` or plain "7.5/10"), pending ones marked with a dashed dot, each linking to `/books/{id}`. A second click or an "×" clears it.
- **"Not started yet" strip** under the chart when `pendingGenres` is non-empty: small dashed pills, e.g. "Biography & Autobiography · 2 waiting", each selecting that genre's panel (read list will be empty — say "Nothing read here yet").
- Footnote: "Wishlist counts cover your whole shelf, not just {year}." when the year range is active.

**3. How you rate** — recharts `BarChart` over `ratings` (0.5 steps).
- x = rating value, y = books; `ReferenceLine` at `avgRating`; caption = `ratingsNote`.
- Keep the star metaphor out of it: this is a histogram, not stars.

**Accessibility**
- Each card: `<section aria-labelledby>`; charts get `accessibilityLayer` (recharts 3) and are wrapped so screen readers get the text equivalent: a visually hidden `<table>` (or `<ul>`) per chart with the same numbers.
- The bubble panel is keyboard reachable: render the genre list as real `<button>`s in the "Not started yet" strip and give the hidden table's rows links to the same panel, or make each bubble a focusable element with a label — whichever keeps the DOM honest.
- Respect `prefers-reduced-motion` (recharts `isAnimationActive={false}` under motion-reduce, as reading-stats does if it does).

### site-header.tsx

Add `{ href: "/insights", label: "Insights", icon: <lucide icon, e.g. ChartNoAxesColumn or Sparkles> }` to the `NAV` array (line ~17) so it appears in both the desktop row and the mobile menu. Keep the existing order sensible: Library, Wishlist, Insights.

### Verify

- `pnpm lint`, `pnpm typecheck`, `pnpm build:ci`.
- Visual check if feasible: the dev server runs at http://localhost:3000 but `/insights` needs a session. A throwaway route rendering `InsightsCharts` with data built from the real DB (like the reading map was checked) is acceptable — screenshot desktop + 375px, light + dark, with a bubble selected — but you MUST delete the route afterwards and confirm `git status` is clean of it. State plainly what you verified and what you did not.

## Acceptance Criteria

- [ ] `/insights` renders the three cards with the range toggle; empty datasets hide their card; no-data state handled.
- [ ] Bubble chart uses the fitted rating domain with an explicit average reference line and dashed pending rings; "Other" never appears (task-01 drops it).
- [ ] Genre panel lists that genre's books with links; "Not started yet" strip works.
- [ ] Eras bars de-emphasise decades with fewer than 3 rated books; caption rendered when present.
- [ ] Ratings histogram with average line and caption.
- [ ] Nav link present in desktop and mobile menus.
- [ ] Text equivalent for each chart; keyboard can reach every genre.
- [ ] Phone (375px) and desktop, light and dark, both look polished; lint/typecheck/build pass.
