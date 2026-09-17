# Task 09: Library + wishlist pages

## Status

pending

## Wave

3

## Description

Wires everything together on `/library` and `/wishlist`: load the whole shelf once, parse URL params, derive counts/subjects/highlights/sections in JS, and render header + view toggle, search, highlights, toolbar and grid. The wishlist additionally shows community ratings and refreshes stale ones in the background. Finally removes the now-unused `getShelf` query.

## Dependencies

**Depends on:** task-02-shelf-logic.md, task-04-queries-ratings.md, task-06-shelf-components.md, task-07-shelf-toolbar.md
**Blocks:** None

**Context from dependencies:**
- task-02, `src/lib/shelf.ts`: `parseShelfParams(params, shelf): ShelfFilters` (`{ status, subject, author, collection, sort, view }`, invalid → ignored/defaults), `hasActiveFilters(f)`, `filterBooks(books, f, { ignoreStatus? })`, `statusCounts(books)`, `topSubjects(books)`, `shouldGroup(shelf, f)`, `groupByYear(books)` → `ShelfSection[]`, `libraryHighlights(books, year)` / `wishlistHighlights(books)` → `Highlights | null`, `pickStaleForRating(books)` (≤ 5 books needing an OL rating lookup).
- task-04, `src/lib/queries.ts`: `getShelfView(userId, shelf, sort): Promise<{ books: ShelfBookRow[]; collections: { id; name }[] }>` (`ShelfBookRow = Book & { collectionIds: string[] }`, sorted in SQL, collections limited to this shelf). `src/lib/ratings.ts`: `refreshRatings(userId, books: { id; title; author }[])` — call only inside `after()`.
- task-06: `ShelfGrid({ books, sections, view, showCommunityRating?, renderAction? })` (`src/components/books/shelf-grid.tsx`), `ShelfHighlights({ highlights })` (`shelf-highlights.tsx`).
- task-07: `ShelfToolbar({ shelf, filters, counts, subjects, collections, count })` (`shelf-toolbar.tsx`; `counts` null on wishlist), `ViewToggle({ view })` (`view-toggle.tsx`).

## Files to Create

None.

## Files to Modify

- `src/app/library/page.tsx`
- `src/app/wishlist/page.tsx`
- `src/lib/queries.ts` — delete `getShelf` (and imports it alone used) once no page uses it

## Technical Details

Keep existing pieces: `requireAuth`, `metadata`, `BookSearch`, the Dachshund empty-state illustrations and copy, container classes `container mx-auto max-w-6xl px-4 py-6 sm:py-8`. UI copy English.

### library/page.tsx

```tsx
export default async function LibraryPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuth();
  const filters = parseShelfParams(await searchParams, "library");
  const { books, collections } = await getShelfView(session.user.id, "library", filters.sort);

  const visible = filterBooks(books, filters);
  const counts = statusCounts(filterBooks(books, filters, { ignoreStatus: true }));
  const subjects = topSubjects(books);
  const highlights = hasActiveFilters(filters) ? null : libraryHighlights(books, new Date().getFullYear());
  const sections = shouldGroup("library", filters) ? groupByYear(visible) : null;
  ...
}
```
Render order:
1. `header.mb-5`: `flex items-start justify-between gap-3` — left: existing h1 "Library" + subtitle; right: `<ViewToggle view={filters.view} />` (only when `books.length > 0`).
2. `<BookSearch className="mb-5" />`
3. `highlights && <ShelfHighlights highlights={highlights} />` inside `div.mb-6`
4. `books.length > 0 && <ShelfToolbar shelf="library" filters={filters} counts={counts} subjects={subjects} collections={collections} count={visible.length} />`
5. Content:
   - `books.length === 0` → existing empty state ("Your shelf is empty" + search hint).
   - `visible.length === 0` → filtered empty state: DachshundReading, "Nothing matches these filters", and a "Clear filters" `Button asChild variant="outline" size="sm"` → `Link` to `/library` keeping only `sort` (if not default) and `view` (if wall). Replaces the old "Try a different status filter." copy.
   - else `<div className="mt-5"><ShelfGrid books={visible} sections={sections} view={filters.view} /></div>`

### wishlist/page.tsx

Same structure with `"wishlist"`:
- `counts` → pass `null` to the toolbar (no status on wishlist).
- `highlights = hasActiveFilters(filters) ? null : wishlistHighlights(books)`.
- `sections = null` (never grouped).
- `ShelfGrid` with `showCommunityRating` and `renderAction={(b) => <StartReadingButton id={b.id} title={b.title} />}`.
- Background rating refresh (capture values first; never call request APIs inside the callback):
  ```ts
  import { after } from "next/server";
  const stale = pickStaleForRating(books);
  if (stale.length) {
    const userId = session.user.id;
    after(() => refreshRatings(userId, stale.map(({ id, title, author }) => ({ id, title, author }))));
  }
  ```
- Keep the existing wishlist empty state (DachshundSleeping, "Nothing on the wishlist"); filtered empty state as on library with `/wishlist`.

### queries.ts

Delete `getShelf` (grep the repo first: `getShelf(` must have no remaining callers). Leave everything else.

### Verification (required)

- `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build:ci` must all pass (this is the last wave — the whole project must be clean).
- Run the app (`pnpm dev`) and check with the playwright-cli skill or a browser if available: `/library` default grouped view, a status chip, `?view=wall`, a subject filter, `/wishlist` with community rating sort, at 375px and desktop widths. Signed-in pages need a session; if you can't sign in automatically, say so rather than claiming it was verified.

## Acceptance Criteria

- [ ] `/library`: highlights (no filters), status chips with counts, Subject/Collection/Sort, author chip when `?author=`, year-grouped sections on default sort, flat grid on other sorts, wall view.
- [ ] `/wishlist`: highlights, filters, community-rating cards + sort, Start reading buttons, wall view, background rating refresh.
- [ ] Filtered empty state with working "Clear filters" on both pages.
- [ ] `getShelf` removed with no remaining references.
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build:ci` pass.
