# Task 02: Pure shelf logic (params, filters, counts, groups, highlights)

## Status

complete

## Wave

1

## Description

The shelf pages will load a user's whole shelf once and derive everything else in plain TypeScript: URL param parsing, filtering, status counts, subject facets, year sections and highlight picks. This task writes those pure, unit-tested functions plus the shared sort/view constants, so the UI tasks and page tasks all agree on one set of types. No React, no DB.

## Dependencies

**Depends on:** None (Wave 1)
**Blocks:** task-04-queries-ratings.md, task-06-shelf-components.md, task-07-shelf-toolbar.md, task-08-book-page.md, task-09-shelf-pages.md

**Context from dependencies:** None. Task-01 (parallel) adds `olRating`, `olRatingCount`, `olRatingCheckedAt` to the book row; this task does NOT import the schema — it uses its own structural types so it compiles independently.

## Files to Create

- `src/lib/shelf.ts` — pure functions + types
- `src/lib/shelf.test.ts` — node:test unit tests

## Files to Modify

- `src/lib/books.ts` — add `community` sort, per-shelf sort lists, defaults, views, rating threshold

## Technical Details

Stack notes: tsconfig is strict with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Tests run with `pnpm test` = `node --experimental-strip-types --test "src/**/*.test.ts"`, so **runtime imports in shelf.ts and the test must be relative with `.ts` extension** (`import { STATUSES } from "./books.ts"`); `import type` may use anything. See `src/lib/books.test.ts` for style. Dates in the DB are plain `"YYYY-MM-DD"` strings (`startedAt`, `finishedAt`); `createdAt` and `olRatingCheckedAt` are `Date`. Personal rating is 0.5–10 (`rating`), community rating is 1–5 (`olRating`).

### 1. `src/lib/books.ts` changes

```ts
export const SORTS = {
  recent: "Recently active",
  title: "Title A–Z",
  author: "Author A–Z",
  rating: "Highest rated",
  finished: "Recently finished",
  added: "Recently added",
  year: "Publication year",
  community: "Community rating",
} as const;

/** Which sorts make sense on which shelf — a wishlist book has no finish date or own rating. */
export const SHELF_SORTS: Record<Shelf, readonly SortKey[]> = {
  library: ["recent", "title", "author", "rating", "finished", "added", "year"],
  wishlist: ["added", "title", "author", "community", "year"],
};

export const DEFAULT_SORT: Record<Shelf, SortKey> = { library: "recent", wishlist: "added" };

export const VIEWS = ["grid", "wall"] as const;
export type View = (typeof VIEWS)[number];

/** Below this many Open Library ratings an average is noise ("5.0 from 1"). */
export const MIN_COMMUNITY_RATINGS = 5;
```
Keep `isSortKey` as is. NOTE: adding `community` makes `ORDER_BY: Record<SortKey, SQL[]>` in `src/lib/queries.ts` fail typecheck — that is expected and fixed by task-04 in the next wave. Do not edit queries.ts.

### 2. `src/lib/shelf.ts` — exact exports

```ts
import type { Shelf, SortKey, Status, View } from "./books.ts";
import { DEFAULT_SORT, MIN_COMMUNITY_RATINGS, SHELF_SORTS, STATUSES, VIEWS } from "./books.ts";

/** The fields shelf logic reads. The DB row (plus collectionIds) satisfies it. */
export type ShelfBook = {
  id: string;
  title: string;
  author: string | null;
  status: string | null;
  rating: number | null;
  pages: number | null;
  subjects: string[] | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: Date;
  olRating: number | null;
  olRatingCount: number | null;
  collectionIds: string[];
};

export type ShelfFilters = {
  status: Status | undefined;
  subject: string | undefined;
  author: string | undefined;
  collection: string | undefined;
  sort: SortKey;
  view: View;
};

type RawParams = Record<string, string | string[] | undefined>;
export function parseShelfParams(params: RawParams, shelf: Shelf): ShelfFilters;
export function hasActiveFilters(f: ShelfFilters): boolean;
export function filterBooks<T extends ShelfBook>(books: T[], f: ShelfFilters, opts?: { ignoreStatus?: boolean }): T[];
export type StatusCounts = { all: number; reading: number; finished: number; abandoned: number };
export function statusCounts(books: ShelfBook[]): StatusCounts;
export function topSubjects(books: ShelfBook[], max?: number): string[];
export function readingDays(startedAt: string | null, finishedAt: string | null): number | null;
export function formatDays(days: number): string;
export type ShelfSection<T> = { key: string; title: string | null; summary: string | null; books: T[] };
export function shouldGroup(shelf: Shelf, f: ShelfFilters): boolean;
export function groupByYear<T extends ShelfBook>(books: T[]): ShelfSection<T>[];
export type Highlight<T> = { label: string; value: string; book: T };
export type Highlights<T> = { title: string; items: Highlight<T>[] };
export function libraryHighlights<T extends ShelfBook>(books: T[], year: number): Highlights<T> | null;
export function wishlistHighlights<T extends ShelfBook>(books: T[], now?: Date): Highlights<T> | null;
export const RATING_TTL_DAYS = 30;
export function pickStaleForRating<T extends { olRatingCheckedAt: Date | null }>(books: T[], now?: Date, max?: number): T[];
export function hasCommunityRating(b: { olRating: number | null; olRatingCount: number | null }): boolean;
```

### 3. Behaviour

**parseShelfParams(params, shelf)** — take the first value when an array. Invalid → ignored (undefined / default).
- `status`: only on `library`; must be in `STATUSES`.
- `subject`, `author`: trimmed; empty or > 200 chars → undefined.
- `collection`: must match `/^[0-9a-f-]{36}$/i`.
- `sort`: must be in `SHELF_SORTS[shelf]`, else `DEFAULT_SORT[shelf]`.
- `view`: in `VIEWS`, else `"grid"`.

**hasActiveFilters** — true if any of status/subject/author/collection is set (sort & view are not filters).

**filterBooks** — AND of: status equal (skipped when `ignoreStatus`); subject case-insensitive equal to any entry in `subjects`; author case-insensitive equal (trimmed); `collectionIds.includes(collection)`. Preserves input order.

**statusCounts** — `all` = books.length; the others count exact status. Null-status books count only in `all`. (Pages call it on books filtered with `ignoreStatus: true`.)

**topSubjects(books, max = 12)** — count subjects case-insensitively (key = lowercased trimmed); display label = the most frequent original casing (ties: first seen). Drop Open Library noise via a stoplist compared lowercased: `"accessible book"`, `"protected daisy"`, `"in library"`, `"lending library"`, `"large type books"`, `"fiction"` is NOT stoplisted. Also drop anything starting with `"overdrive"` or containing `"nyt:"`. Sort by count desc, then label asc. Return labels.

**readingDays(startedAt, finishedAt)** — inclusive whole days, parse `YYYY-MM-DD` as UTC (`Date.UTC`). Same day = 1. Null if either missing/unparseable or finish < start.
**formatDays(d)** — `"1 day"` / `"12 days"`.

**shouldGroup(shelf, f)** — `shelf === "library" && f.sort === "recent" && f.status !== "reading" && f.status !== "abandoned"`.

**groupByYear(books)** — classify each book (input order preserved within a section), precedence:
1. status `"reading"` → section key `"reading"`, title `"Reading"`
2. status `"abandoned"` → `"abandoned"`, title `"Abandoned"`
3. `finishedAt` present → key `"year-2026"`, title `"2026"`
4. else → `"no-date"`, title `"No date"`
Output order: Reading, years descending, No date, Abandoned. Omit empty sections. Summaries:
- year sections: parts joined with `" · "`: `"14 books"` (`"1 book"`), `"4,320 pages"` only when page sum > 0 (format with `toLocaleString("en-GB")`), `"avg 7.8"` only when ≥1 rated book (mean of `rating`, one decimal, trailing `.0` kept e.g. `"avg 8.0"`).
- other sections: `"2 books"`.

**libraryHighlights(books, year)** — candidates = status `"finished"` books whose `finishedAt` starts with `${year}-`; title `` `${year} highlights` ``. If none, candidates = all finished books and title `"All-time highlights"`. If still none → null. Items in order, each skipping books already used by an earlier item, each omitted if no candidate:
- `"Top rated"`: max `rating` (non-null); value `` `${rating}/10` `` (e.g. `"9.5/10"`, `"8/10"`).
- `"Longest"`: max `pages` (non-null, > 0); value `` `${pages.toLocaleString("en-GB")} pages` ``.
- `"Quickest read"`: min `readingDays` (non-null); value `` `Read in ${formatDays(d)}` ``.
Ties: first in input order. Return null if items is empty.

**wishlistHighlights(books, now = new Date())** — title `"Highlights"`. If `books.length === 0` → null. Items (same skip-used rule):
- `"Shortest"`: min `pages` (non-null, > 0); value `"212 pages"`.
- `"Waiting longest"`: min `createdAt`; value `` `Added ${monthYear}` `` where monthYear = `createdAt.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })` e.g. `"Added Mar 2025"`.
- `"Best rated on Open Library"`: max `olRating` among books where `hasCommunityRating`; value `` `${olRating.toFixed(1)}/5` ``.
Return null if items empty. (`now` is accepted for future use/testing; fine to leave unused only if lint allows — otherwise drop the param.)

**hasCommunityRating(b)** — `b.olRating != null && (b.olRatingCount ?? 0) >= MIN_COMMUNITY_RATINGS`.

**pickStaleForRating(books, now = new Date(), max = 5)** — books with `olRatingCheckedAt === null` first (input order), then those older than `RATING_TTL_DAYS` (oldest first); return at most `max`.

### 4. Tests (`src/lib/shelf.test.ts`)

Use a `book(overrides)` factory. Cover at least: parseShelfParams (invalid status/sort/view/collection ignored; status ignored on wishlist; array params); filterBooks (case-insensitive subject/author, collection, ignoreStatus); statusCounts with a null-status book; topSubjects (case dedupe, stoplist, order, max); readingDays (same day = 1, reversed = null, missing = null); groupByYear (section order, abandoned-with-finish-date goes to Abandoned, null-status no-date goes to No date, summary strings incl. "1 book" and omitted pages/avg); shouldGroup; libraryHighlights (this-year vs all-time fallback title, no double-use of a book, null when no finished); wishlistHighlights (community threshold respected); pickStaleForRating (null first, TTL, max).

## Acceptance Criteria

- [ ] `src/lib/books.ts` exports `SORTS` (with `community`), `SHELF_SORTS`, `DEFAULT_SORT`, `VIEWS`, `View`, `MIN_COMMUNITY_RATINGS`.
- [ ] `src/lib/shelf.ts` exports exactly the API above with the described behaviour; no React/DB imports.
- [ ] `node --experimental-strip-types --test src/lib/shelf.test.ts` passes, and `pnpm test` passes.
- [ ] `pnpm lint` clean for the new/changed files; typecheck clean for them (the known `queries.ts` ORDER_BY error is expected until task-04).
