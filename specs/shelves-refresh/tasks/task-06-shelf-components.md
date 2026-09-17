# Task 06: Shelf display components (card, community rating, highlights, grid)

## Status

complete

## Wave

2

## Description

Presentational server components the Library and Wishlist pages will compose: a richer book card with a compact "wall" variant, a community-rating line visually distinct from the user's own stars, a highlights strip of single books, and a grid that renders either flat or in titled year sections. No data fetching and no URL state here.

## Dependencies

**Depends on:** task-01-schema-migration.md, task-02-shelf-logic.md
**Blocks:** task-09-shelf-pages.md

**Context from dependencies:**
- task-01: the `Book` type (`typeof book.$inferSelect`, exported from `src/lib/queries.ts`) now also has `olRating: number | null` (Open Library average, 1–5), `olRatingCount: number | null`, `olRatingCheckedAt: Date | null`.
- task-02, in `src/lib/books.ts`: `View = "grid" | "wall"`, `MIN_COMMUNITY_RATINGS = 5`. In `src/lib/shelf.ts`:
  - `readingDays(startedAt, finishedAt): number | null` (inclusive days, same day = 1) and `formatDays(d)` → `"1 day"`/`"12 days"`.
  - `hasCommunityRating({ olRating, olRatingCount }): boolean` (non-null and count ≥ 5).
  - `type ShelfSection<T> = { key: string; title: string | null; summary: string | null; books: T[] }` — e.g. `{ key: "year-2026", title: "2026", summary: "14 books · 4,320 pages · avg 7.8", books }`.
  - `type Highlight<T> = { label: string; value: string; book: T }`, `type Highlights<T> = { title: string; items: Highlight<T>[] }` — e.g. title `"2026 highlights"`, item `{ label: "Longest", value: "812 pages", book }`.

## Files to Create

- `src/components/books/community-rating.tsx`
- `src/components/books/shelf-highlights.tsx`
- `src/components/books/shelf-grid.tsx`

## Files to Modify

- `src/components/books/book-card.tsx` — meta line, community rating, wall variant, equal-height footer

## Technical Details

Read `DESIGN.md` and the live tokens in `src/app/globals.css` first (warm red/rust theme; `--star` gold is reserved for the user's OWN rating; headings use `font-display`). Reuse existing pieces: `BookCoverImage` (`src/components/books/book-cover-image.tsx`), `StarRatingDisplay`, `Badge`, `cn`. Icons from `lucide-react`. UI copy English. These are server components (no `"use client"`). Keep props backwards compatible: `<BookCard book={b} />` and `<BookCard book={b} action={...} />` must still work, because the pages are only rewired in task-09.

### community-rating.tsx

```tsx
export function CommunityRating({ rating, count, className }: {
  rating: number | null; count: number | null; className?: string;
})
```
- Returns `null` unless `hasCommunityRating({ olRating: rating, olRatingCount: count })`.
- Visual: NO star glyph, NO `--star`/gold colour — must never be confused with the user's 10-star rating. Lucide `Users` icon `size-3` + text `4.3/5 · 444 ratings` (`rating.toFixed(1)`, count with `toLocaleString("en-GB")`), `text-xs text-muted-foreground tabular-nums`, inline-flex gap-1.
- Visible part `aria-hidden`, plus `<span className="sr-only">Open Library community rating 4.3 out of 5 from 444 ratings</span>`.

### book-card.tsx

New props (all optional): `variant?: "grid" | "wall"` (default grid), `showCommunityRating?: boolean`.

Grid variant (existing layout plus):
- Root gets `h-full`; the `action` wrapper becomes `mt-auto pt-2` so "Start reading" buttons align across a row.
- Line order under the cover: title, author, own `StarRatingDisplay`, "Finished {date}" (existing), meta line, community rating, action.
- Meta line (`text-xs text-muted-foreground tabular-nums`): parts joined `" · "`: `"350 pages"` when `pages`; `formatDays(d)` when `status === "finished"` and `readingDays(startedAt, finishedAt)` non-null. Omit the line when no parts.
- `showCommunityRating` → `<CommunityRating rating={book.olRating} count={book.olRatingCount} />`.
- Author stays plain text (no link — author filtering is reached from the book page).

Wall variant:
- Only the cover link, no text below, no status badge.
- Link `aria-label`: `` `${title}${author ? ` by ${author}` : ""}${status ? `, ${STATUS_LABELS[status].toLowerCase()}` : ""}` ``; also `title={book.title}` (hover nicety only).
- Keep the existing `card-interactive` hover and `focus-visible:ring-[3px]` classes, and the existing fallback that shows the title when there is no cover (it is the only way to identify coverless books on the wall).
- `sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 160px"`.

### shelf-highlights.tsx

```tsx
export function ShelfHighlights({ highlights }: { highlights: Highlights<Book> })
```
- `<section aria-labelledby>`: `h2` with `highlights.title` in `font-display text-lg font-semibold`.
- Tiles: mobile horizontal scroll `flex gap-3 overflow-x-auto snap-x pb-1` with tiles `w-64 shrink-0 snap-start`; from `sm:` a `grid grid-cols-3` (tiles `w-auto`). Tile classes like the home StatTile (`rounded-lg border bg-card p-3 shadow-sm`), whole tile is a `Link` to `/books/${book.id}` with `card-interactive` hover and focus ring.
- Tile content: row with small cover (`relative aspect-2/3 w-12 shrink-0 overflow-hidden rounded-md border bg-muted`, `BookCoverImage` with `sizes="48px"` and a `BookOpen` icon fallback) + text column: label (`text-xs text-muted-foreground`), title (`text-sm font-semibold line-clamp-2`), value (`text-xs text-muted-foreground tabular-nums`).

### shelf-grid.tsx

```tsx
export function ShelfGrid({ books, sections, view, showCommunityRating, renderAction }: {
  books: Book[];                          // used when sections is null
  sections: ShelfSection<Book>[] | null;  // null → one flat grid
  view: View;
  showCommunityRating?: boolean;
  renderAction?: (book: Book) => React.ReactNode;  // server→server only, e.g. wishlist StartReadingButton
})
```
- Grid classes: grid view `grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4` (existing); wall view `grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7`. `<ul>`/`<li>` like today.
- Wall → `variant="wall"` and no action/community rating.
- Sections: wrapper `space-y-8`; each `<section aria-labelledby={id}>` with `h2` (`font-display text-xl font-semibold`) and summary `<p className="text-xs text-muted-foreground tabular-nums">` below, then the grid with `mt-3`. A section with `title === null` renders just the grid. No sticky headers.
- Type the `books`/`sections` generically enough that a `Book & { collectionIds: string[] }` row is accepted (e.g. `T extends Book`).

## Acceptance Criteria

- [ ] Existing `<BookCard book action />` usages compile and render as before plus the meta line.
- [ ] Community rating renders only with ≥ 5 ratings, has no star glyph or gold colour, has sr-only full text.
- [ ] Wall variant shows cover only with descriptive `aria-label`, title fallback for coverless books, focus ring intact.
- [ ] `ShelfHighlights` scrolls horizontally on phones and is 3 columns from `sm`.
- [ ] `ShelfGrid` renders flat or sectioned, grid or wall, with semantic headings.
- [ ] `pnpm lint` clean; typecheck clean for these files.
