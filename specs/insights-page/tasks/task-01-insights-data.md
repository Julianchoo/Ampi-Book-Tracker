# Task 01: Insights data + pure logic

## Status

complete

## Wave

1

## Description

Builds everything the `/insights` page needs as data: one query for the user's books and pure, unit-tested functions that turn them into the three chart datasets (decades, genre bubbles, rating distribution) plus their captions. A parallel task (task-02) builds the page against the exact contract below, so exported names and shapes must match.

## Dependencies

**Depends on:** None (Wave 1)
**Blocks:** None (task-02 runs in parallel against the contract)

**Context from dependencies:** None. Existing code you build on:
- `src/lib/constellation.ts` — `buildGenreGraph(books: MapBookInput[])` already normalises the messy subject strings into genres (2 levels, synonyms merged, ≥ 2 books to qualify, max 2 genres per book, catch-all `"other"`). It returns `{ genres: GenreNode[]; books: BookNode[]; links; topGenreIds }` where each `BookNode` has `genreIds`. REUSE IT — do not write a second genre model.
- `src/lib/queries.ts` — Drizzle queries, all scoped by `userId`; `getConstellationBooks` shows the "select only the fields the client needs" pattern.
- `src/lib/books.ts` — `MAX_RATING` (10), `RATING_STEP` (0.5), `coverUrls`.

## Files to Create

- `src/lib/insights.ts` — types (the contract) + pure builders
- `src/lib/insights.test.ts` — node:test tests

## Files to Modify

- `src/lib/queries.ts` — add `getInsightsBooks`

## Technical Details

Tests run with `node --experimental-strip-types`: runtime imports inside `insights.ts` must be relative with `.ts` (`import { buildGenreGraph } from "./constellation.ts"`). tsconfig is strict with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.

### Contract — `src/lib/insights.ts`

```ts
import type { MapBookInput } from "./constellation.ts";

/** A book as the insights page sees it: the genre input plus the dated fields. */
export type InsightsBook = MapBookInput & {
  finishedAt: string | null;      // "YYYY-MM-DD"
  firstPublishYear: number | null;
};

export type DecadeBar = {
  decade: number;        // 1990, 2000 …
  label: string;         // "1990s"
  books: number;         // books published in that decade (read side)
  rated: number;         // how many of them you rated
  avgRating: number | null;
};

export type GenreBubble = {
  id: string;
  label: string;
  read: number;          // finished library books in this genre (in range)
  pending: number;       // wishlist books in this genre (always all-time)
  rated: number;
  avgRating: number;     // bubbles only exist when this is known
  /** Up to 3 of the genre's best-rated read books, for the panel/tooltip. */
  topBooks: { id: string; title: string; rating: number | null }[];
};

/** Genres with nothing read yet — the "Not started yet" strip. */
export type PendingGenre = { id: string; label: string; pending: number };

export type RatingBar = { rating: number; books: number };

export type Insights = {
  /** Which slice the read-side numbers cover. */
  range: "all" | "year";
  year: number;
  decades: DecadeBar[];
  /** Caption naming the best/worst-rated decade with enough books. */
  decadesNote: string | null;
  bubbles: GenreBubble[];
  pendingGenres: PendingGenre[];
  /** Fitted x-domain for the bubble chart, e.g. [5.2, 8.1]. */
  ratingDomain: [number, number];
  /** Mean rating across the read books in range, for the reference line. */
  avgRating: number | null;
  ratings: RatingBar[];
  ratingsNote: string | null;
  /** Books linked to each bubble, for the detail panel. */
  booksByGenre: Record<string, { id: string; title: string; author: string | null; rating: number | null; pending: boolean }[]>;
  counts: { read: number; pending: number; rated: number };
};

export function buildInsights(books: InsightsBook[], opts: { range: "all" | "year"; year: number }): Insights;
```

### Rules

**Read side** = books with `shelf === "library"` and `status === "finished"`; when `range === "year"`, additionally `finishedAt` starting with `${year}-`. **Pending** = `shelf === "wishlist"`, never filtered by year (wishlist has no date).

**Genres**: run `buildGenreGraph` over ALL the user's books (read + pending, unfiltered by year) so genre membership is stable, then:
- Drop the `"other"` genre entirely (it is the catch-all).
- A `GenreBubble` needs ≥ 2 read books **in range** and at least one of them rated; `avgRating` = mean of their ratings.
- `pending` counts wishlist books linked to that genre.
- A genre with 0 read books in range but ≥ 1 pending goes to `pendingGenres` (sorted by pending desc, then label).
- Sort bubbles by `read` desc, then label.

**ratingDomain**: `[floor(min - 0.3), ceil(max + 0.3)]` clamped to `[0, MAX_RATING]` where min/max are over the bubbles' `avgRating`; if fewer than 2 bubbles, fall back to `[max(0, avg - 1), min(10, avg + 1)]`; always at least 1.0 wide.

**Decades**: over the read side with a `firstPublishYear`; `decade = floor(year / 10) * 10`; include every decade between the earliest and latest present (gaps as zero-book bars are fine — say so in the label ordering). `decadesNote`: compare only decades with ≥ 3 rated books; if at least two qualify, e.g. `"Your 2010s books score best (7.5); the 2020s trail at 6.3."`; otherwise `null`. Never build a claim on a single book.

**Ratings**: buckets of `RATING_STEP` (0.5) from the lowest to the highest rating present (no empty tails), `books` = how many read-side books have exactly that rating. `avgRating` = mean. `ratingsNote` mentions the most common rating and the share within ±1 of the average, e.g. `"You give 7 most often — 68% of your ratings land between 6 and 8."`; `null` when fewer than 5 rated books.

**booksByGenre**: for each bubble id, its read books (rating desc, then title) followed by its pending ones (title asc), `pending: true` for the latter. Read books are the in-range ones.

Return early-but-valid objects when data is thin: empty arrays rather than throwing; the page hides empty charts.

### Query — `src/lib/queries.ts`

```ts
/** Both shelves, only the fields the insights page needs. */
export async function getInsightsBooks(userId: string): Promise<InsightsBook[]>
```
Type-only import of `InsightsBook` from `@/lib/insights`. Select exactly those fields from `book` where `userId` matches.

### Tests (`src/lib/insights.test.ts`)

Factory over `InsightsBook`. Cover: read/pending classification and the year filter; wishlist ignoring the year; "other" excluded; the ≥ 2-read rule; pendingGenres; bubble sort; ratingDomain fitting (including the 1-bubble fallback and the minimum width); decade bucketing and gap handling; `decadesNote` staying null when only one decade has ≥ 3 rated books; rating buckets with no empty tails; `ratingsNote` null under 5 ratings; `booksByGenre` ordering; determinism.

### Verify

`pnpm test`, `pnpm lint`, `pnpm typecheck`. Then a read-only check against the real database from the repo root (a temp `.mts` file you DELETE afterwards, or the scratchpad if module resolution allows): build insights for each user and print the bubbles, decades, ratingDomain and both notes. Expected for the main account: genre averages in a 5.6–7.8 band, ~17 bubbles after dropping "Other" and the 1-book genres, decades 2020s 22 / 2010s 21 / 2000s 18 / 1990s 8 plus single-book decades back to the 1940s. Report the actual output. Typecheck errors from task-02's files (`src/app/insights/*`, `src/components/books/insights-*`) are not yours.

## Acceptance Criteria

- [ ] Contract exported exactly as above; genre logic reuses `buildGenreGraph`.
- [ ] Year toggle affects the read side only; wishlist rings stay all-time.
- [ ] "Other" never appears as a bubble; no bubble is built on fewer than 2 read books; no note is built on a single book.
- [ ] `ratingDomain` fits the real 5.6–7.8 band instead of 0–10.
- [ ] Tests pass; lint and typecheck clean for owned files; real-data check reported.
