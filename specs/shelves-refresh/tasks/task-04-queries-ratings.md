# Task 04: Shelf view queries + background rating refresh

## Status

pending

## Wave

2

## Description

The shelf pages will load a whole shelf once (with each book's collection ids) and filter in JS. This task writes those queries, the collection lookups the book page needs, and a background job that fills in Open Library community ratings — run via `after()` so it never slows a response. It also triggers that refresh when a book is added.

## Dependencies

**Depends on:** task-01-schema-migration.md, task-02-shelf-logic.md, task-03-openlibrary-rating.md
**Blocks:** task-08-book-page.md, task-09-shelf-pages.md

**Context from dependencies:**
- task-01 added to `book` (in `src/lib/schema.ts`): `olRating real` (1–5, nullable), `olRatingCount integer`, `olRatingCheckedAt timestamp` (null = never looked up); and tables `collection { id uuid, userId text, name text, createdAt }` (unique on userId + lower(name)) and `bookCollection { bookId uuid, collectionId uuid }` (composite PK). Drizzle exports: `book`, `collection`, `bookCollection`.
- task-02 added to `src/lib/books.ts` a `community` key in `SORTS` (so `ORDER_BY: Record<SortKey, SQL[]>` in queries.ts currently fails typecheck — fix it here), plus `MIN_COMMUNITY_RATINGS = 5`. In `src/lib/shelf.ts` it exports `pickStaleForRating(books, now?, max = 5)` (returns books whose `olRatingCheckedAt` is null or > 30 days old, nulls first) — callers use it to choose what to pass to `refreshRatings`.
- task-03 added to `src/lib/openlibrary.ts`: `getOpenLibraryRating({ title, author }): Promise<{ average: number | null; count: number } | null>` — `null` means the request failed (retry later), `{count: 0}` means answered with nothing.

## Files to Create

- `src/lib/ratings.ts` — `refreshRatings` background job

## Files to Modify

- `src/lib/queries.ts` — `community` ORDER_BY entry, `getShelfView`, `getBookCollections`, `getUserCollections`, types
- `src/lib/actions/books.ts` — schedule rating lookup after `addBook`

## Technical Details

Every query is scoped by `userId` (see comment at top of `src/lib/actions/books.ts`). Do NOT remove the existing `getShelf` — task-09 removes it once the pages stop using it.

### queries.ts

```ts
import { bookCollection, collection } from "@/lib/schema";
import { MIN_COMMUNITY_RATINGS } from "@/lib/books";

// in ORDER_BY:
community: [
  sql`case when ${book.olRatingCount} >= ${MIN_COMMUNITY_RATINGS} then ${book.olRating} end desc nulls last`,
  asc(book.title),
],

export type ShelfBookRow = Book & { collectionIds: string[] };
export type CollectionOption = { id: string; name: string };

/**
 * A whole shelf plus each book's collections, sorted in SQL. Filtering happens
 * in JS (src/lib/shelf.ts) because counts, subject facets and highlights all
 * need the unfiltered shelf anyway.
 * ponytail: whole shelf in memory; push filters into SQL if a shelf reaches thousands.
 */
export async function getShelfView(userId: string, shelf: Shelf, sort: SortKey): Promise<{
  books: ShelfBookRow[];
  /** Collections with at least one book on THIS shelf, by name. */
  collections: CollectionOption[];
}>
```
Implementation: two queries in `Promise.all`:
1. `db.select().from(book).where(and(eq(book.userId, userId), eq(book.shelf, shelf))).orderBy(...ORDER_BY[sort])`
2. memberships: `db.select({ bookId: bookCollection.bookId, collectionId: collection.id, name: collection.name }).from(bookCollection).innerJoin(collection, eq(collection.id, bookCollection.collectionId)).innerJoin(book, eq(book.id, bookCollection.bookId)).where(and(eq(collection.userId, userId), eq(book.userId, userId), eq(book.shelf, shelf)))`
Build a `Map<bookId, string[]>` and a deduped collections list sorted by name (`localeCompare`). Use typed Drizzle queries, not `array_agg`.

```ts
/** Collections this book is in. */
export async function getBookCollections(userId: string, bookId: string): Promise<CollectionOption[]>
/** Every collection that has at least one book (empty ones are hidden, never deleted), by name. */
export async function getUserCollections(userId: string): Promise<CollectionOption[]>
```
`getUserCollections`: select distinct id, name from collection inner join bookCollection where collection.userId = userId, order by lower(name).

### ratings.ts

```ts
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getOpenLibraryRating } from "@/lib/openlibrary";
import { book } from "@/lib/schema";

/**
 * Looks up and stores Open Library community ratings. Meant for after():
 * never awaited by a render. Sequential on purpose — Open Library allows
 * about 1 request/second and takes about that long to answer anyway.
 * Stops at the first failed request: if the service is down, the rest would
 * fail too, and each could burn the full 8s timeout.
 */
export async function refreshRatings(
  userId: string,
  books: { id: string; title: string; author: string | null }[]
): Promise<void>
```
For each book: `const r = await getOpenLibraryRating(b)`; if `r === null` → `return` (leave `olRatingCheckedAt` untouched so it retries next time). Else `db.update(book).set({ olRating: r.count > 0 ? r.average : null, olRatingCount: r.count, olRatingCheckedAt: new Date() }).where(and(eq(book.id, b.id), eq(book.userId, userId)))`. (The schema's `$onUpdate` will bump `updatedAt`; that's acceptable — no sort uses it.) Wrap the whole loop in try/catch and swallow (log with `console.error`) — a background job must not throw. Do NOT call `revalidatePath` (value appears on next visit) and do NOT call `headers()`/`cookies()`/`requireAuth` inside (not allowed in `after()` callbacks from a page).

### actions/books.ts — addBook

Import `after` from `next/server`, `refreshRatings` from `@/lib/ratings`, `pickStaleForRating` from `@/lib/shelf`. Extend the insert's `.returning(...)` to `{ id: book.id, olRatingCheckedAt: book.olRatingCheckedAt }`. After a successful insert/upsert:
```ts
// Re-adding a book already on a shelf upserts the same row; skip the lookup if it's fresh.
if (pickStaleForRating([row]).length > 0) {
  const userId = session.user.id;
  after(() => refreshRatings(userId, [{ id: row.id, title: d.title, author: d.author ?? null }]));
}
```
Capture values in locals before `after()`.

### Verify

- `pnpm typecheck` — queries.ts ORDER_BY error must be gone. Remaining errors may only be in `src/app/library/page.tsx` / `src/app/wishlist/page.tsx` caused by task-07's ShelfToolbar prop change (fixed by task-09).
- `pnpm lint`, `pnpm test`.
- Optional: a throwaway tsx script calling `getShelfView` against the dev DB for an existing user to confirm shapes (don't commit it).

## Acceptance Criteria

- [ ] `ORDER_BY.community` sorts by OL rating only when count ≥ 5, nulls last, then title.
- [ ] `getShelfView` returns every book on the shelf with `collectionIds`, and only collections used on that shelf; all queries scoped by userId.
- [ ] `getBookCollections` / `getUserCollections` implemented as specified (empty collections excluded).
- [ ] `refreshRatings` is sequential, stops on first `null`, writes count 0 + checkedAt on "no rating", never throws, never touches request APIs.
- [ ] `addBook` schedules `refreshRatings` via `after()` only when the row's rating is stale/never checked.
- [ ] Existing `getShelf`, `getBook`, `getCurrentlyReading`, `getStats` unchanged.
