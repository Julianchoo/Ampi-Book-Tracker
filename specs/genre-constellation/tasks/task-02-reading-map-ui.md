# Task 02: Reading map UI + home wiring

## Status

complete

## Wave

1

## Description

Builds the beautiful part: a "Your reading map" card on the signed-in home page with a static preview of the genre constellation, and a large dialog with the full interactive map (select books/genres, highlighted connections, detail panel, zoom buttons, Map/List toggle). The user explicitly asked for a very beautiful interface — visual polish is the main acceptance bar. Books are plain dots for now. Data and layout arrive precomputed from the server (task-01, in parallel), so this task ships no d3.

## Dependencies

**Depends on:** None (Wave 1; runs parallel to task-01 against the contract below)
**Blocks:** None

**Context from dependencies:** task-01 creates `src/lib/constellation.ts` exporting the types below, and `src/lib/constellation-layout.ts` exporting `getReadingMap(userId: string): Promise<ReadingMap | null>` (server-only; null when the user has < 3 books with usable subjects). Every node already has `x`, `y`, `r` inside a viewBox of `width`×`height` (1000×720).

```ts
export type GenreNode = { kind: "genre"; id: string; label: string; depth: 0 | 1; parentId: string | null; bookCount: number; x: number; y: number; r: number };
export type BookNode = { kind: "book"; id: string; title: string; author: string | null; shelf: "library" | "wishlist"; status: string | null; rating: number | null; olRating: number | null; olRatingCount: number | null; cover: string[]; genreIds: string[]; x: number; y: number; r: number };
export type MapLink = { source: string; target: string; kind: "parent" | "book" }; // parent: genre→child genre; book: genre→book
export type ReadingMap = { width: number; height: number; genres: GenreNode[]; books: BookNode[]; links: MapLink[]; topGenreIds: string[] };
```
Import types with `import type { ... } from "@/lib/constellation"` (type-only, so the client bundle never pulls server code). Until task-01 lands, typecheck may complain the module is missing — that's expected; code against the contract exactly.

## Files to Create

- `src/components/books/reading-map.tsx` — client: card + preview + dialog shell, selection state, detail panel, Map/List toggle, zoom
- `src/components/books/reading-map-svg.tsx` — client: the SVG renderer used by both preview and dialog

## Files to Modify

- `src/app/page.tsx` — call `getReadingMap` in the existing `Promise.all`, render the card below `<ReadingStatsCharts />`

## Technical Details

**Before designing, invoke the `frontend-design` skill and the `dataviz` skill (Skill tool) and follow them**, within this project's design system: read `DESIGN.md`, `src/app/globals.css` (warm red/rust theme; tokens like `--primary`, `--card`, `--muted-foreground`, `--border`; `--star` gold is ONLY for the user's own rating; `font-display` = Libre Baskerville for headings; `animate-fade-up`, `card-interactive` utilities), `src/app/page.tsx`, `src/components/books/reading-stats.tsx` (home card styling to match), `src/components/ui/dialog.tsx`, `src/components/books/book-cover-image.tsx`, `src/components/books/star-rating.tsx`, `src/components/books/community-rating.tsx`, `src/components/dachshund.tsx` (PawPrint etc. for charm). UI copy English. Icons: lucide-react.

Decisions already made (from design review — don't revisit):
- **Single hue**: nodes use `--primary` (and opacity/tints of it); identity comes from **direct text labels**, no colour legend. The chart palette failed colour-vision validation.
- **Dots, not covers** in the map; the cover appears only in the detail panel via `BookCoverImage`.
- **No pan/pinch/wheel**; zoom via buttons changing the SVG `viewBox`.
- Nodes are `aria-hidden`; the **List view is the keyboard/screen-reader path**.

### reading-map-svg.tsx

```tsx
"use client";
export function ReadingMapSvg({ map, mode, selected, onSelect, viewBox, className }: {
  map: ReadingMap;
  mode: "preview" | "full";
  selected: { kind: "genre" | "book"; id: string } | null;
  onSelect?: (s: { kind: "genre" | "book"; id: string } | null) => void;
  viewBox?: string; // default `0 0 ${map.width} ${map.height}`
  className?: string;
})
```
- `<svg viewBox preserveAspectRatio="xMidYMid meet" aria-hidden>`; build id→node lookup maps with `useMemo`.
- Background: subtle radial glow (a `radialGradient` from `var(--accent)` at low opacity to transparent), optionally a few faint "star" specks for the constellation feel — tasteful, not busy.
- Links: parent links slightly stronger (`stroke: var(--primary)` ~0.25 opacity, 1.25px); book links hairline (`var(--border)` or primary ~0.12). Use gentle curves (quadratic path) rather than straight lines if it reads better.
- Genre nodes: circle `r` with fill primary at low opacity + a soft outer glow ring; depth-0 stronger than depth-1. Labels: depth 0 `font-display` semibold, depth 1 sans medium, `fill: var(--foreground)`, halo via `paint-order: stroke` with `stroke: var(--card)` ~4px so text reads over links in both themes; place label below/beside the node avoiding the circle. In `preview` mode label only `map.topGenreIds`; in `full` label all genres.
- Book dots: library = filled `var(--primary)`; wishlist = `fill: var(--card)` with dashed `var(--primary)` stroke. Radius `node.r` (slightly larger hit target via transparent circle in full mode).
- Selection (full mode): selecting a book highlights it (ring), its links and its genres; selecting a genre highlights it, its child genres, its books and their links; everything else dims to ~0.15 opacity with `transition-opacity duration-300`. Clicking empty background clears. Hover (pointer devices) previews the same highlight without committing selection.
- Entrance animation: nodes fade/scale in with a short stagger (CSS, e.g. `animation-delay` by index capped), disabled under `prefers-reduced-motion`.
- Preview mode: no pointer handlers on nodes; purely decorative.

### reading-map.tsx

```tsx
"use client";
export function ReadingMap({ map }: { map: ReadingMap })
```
- **Card** (matches home cards, e.g. `rounded-xl border bg-card shadow-sm`, header strip like the "Currently reading" hero with `PawPrint`): title "Your reading map", subtitle like "82 books across 20 genres" (count books + genres from `map`). Body: `ReadingMapSvg mode="preview"` at ~`h-64 sm:h-80`. The whole card is one `<button>` (or DialogTrigger asChild) with `aria-label="Open your reading map"`, `card-interactive` hover, focus ring, and an "Explore" affordance (text + `ArrowRight`/`Maximize2` icon).
- **Dialog** (`src/components/ui/dialog.tsx`): large — phones near full-screen (`h-[100dvh] max-w-none rounded-none` or similar), desktop `sm:max-w-5xl sm:h-[85vh]`. `DialogTitle` "Your reading map" + `DialogDescription` summary. Header controls:
  - Map / List toggle: two `aria-pressed` buttons styled like the existing `RangeToggle` in reading-stats.tsx.
  - Zoom: `ZoomIn`, `ZoomOut`, `RotateCcw` icon buttons with aria-labels (Map mode only). Zoom scales the viewBox around the selected node (or centre) in steps (1×, 1.5×, 2.25×, 3.4×), clamped inside the map bounds; animate by CSS transition on a wrapping `<g transform>` or by interpolating viewBox in state with `requestAnimationFrame` — keep it simple and smooth.
- **Map view layout**: desktop = map left (flex-1) + detail panel right (`w-72`); phone = map on top, panel below (scrollable). Map area uses `ReadingMapSvg mode="full"` with selection state.
- **Detail panel**:
  - Nothing selected: short hint ("Tap a genre or a book") + the top genres as small buttons that select them.
  - Book selected: `BookCoverImage` (fallback `BookOpen` icon like book-card) in a small rounded cover frame, title (`font-display`), author, shelf badge (Library/Wishlist), own rating via `StarRatingDisplay` when `rating != null`, or `CommunityRating` for wishlist books (`rating={olRating} count={olRatingCount} checked`), its genre chips (buttons that select the genre), and `Button asChild` → `Link` "Open book" to `/books/${id}`.
  - Genre selected: label, "N books", child genres as chips, and a scrollable list of its books (small dot marker filled/hollow + title as button selecting the book, and a link icon to the book page).
- **List view**: accessible structure — for each depth-0 genre (bookCount desc) an `h3` with count, its depth-1 children as `h4`, each with a `ul` of book `Link`s (title — author, with "wishlist" marker text). Books linked to both parent and child appear under the child only.
- Legend (small, under the map): filled dot "Library", hollow dashed dot "Wishlist", and "Lines connect books to their genres".

### page.tsx

- Import `getReadingMap` from `@/lib/constellation-layout` and `ReadingMap` component.
- Add to the existing `Promise.all`: `getReadingMap(session.user.id)`.
- After `<ReadingStatsCharts stats={stats} />`: `{readingMap && <div className="mt-8"><ReadingMap map={readingMap} /></div>}`.

### Verify

- `pnpm lint`, `pnpm typecheck` (errors caused solely by task-01's in-progress files are not yours; your code must match the contract).
- Visual check: the home page needs a signed-in session. If you can't sign in, say so plainly. Optionally render `ReadingMapSvg` with a small hand-made fixture in a throwaway scratch page outside the repo to sanity-check — do not commit fixtures or demo routes.

## Acceptance Criteria

- [ ] Card on home below stats; preview static and decorative; whole card opens dialog; keyboard-focusable with visible focus ring.
- [ ] Dialog map: all genre labels legible (halo) in light and dark; library filled vs wishlist hollow-dashed dots; selection highlights and dims correctly; hover preview on pointer devices; background click clears.
- [ ] Detail panel for book (cover, title, author, shelf, rating, genre chips, Open book) and genre (count, children, book list).
- [ ] Zoom in/out/reset work and stay in bounds; Map/List toggle with aria-pressed; List view is fully keyboard navigable.
- [ ] Phone (375px) and desktop layouts both look polished; motion respects prefers-reduced-motion.
- [ ] Only `import type` from `@/lib/constellation` in client files; no d3 in client code; `pnpm lint` clean.
