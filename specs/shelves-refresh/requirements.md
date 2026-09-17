# Requirements: Shelves Refresh (Library + Wishlist)

## Summary

The Library and Wishlist pages are currently near-identical flat grids: a search box, a status select, a sort select and a grid of covers. Nothing on them tells the story of what the reader has read, and the wishlist gives no outside signal about which book is worth picking up next.

This feature turns both shelves into something worth browsing: the library groups finished books by year with per-year summaries, shows single-book highlights (top rated, longest, quickest read), status chips with counts, subject/author/collection filters, and a dense cover-wall view. The wishlist gets the same filters, wall view and its own highlights, plus a community rating from Open Library on each card so the user has an outside reference. Users can also put books into their own collections (tags; many per book).

Community ratings are stored on the book row and refreshed in the background with `after()` — never fetched during render — because Open Library is slow (≈1s per request, sometimes much worse) and rate-limited (1 req/s without contact info).

## Goals

- Library: year grouping, status chips with counts, richer cards ("350 pages · 12 days"), subject/author/collection filters, highlights, grid ⇄ cover-wall toggle.
- Wishlist: community rating (Open Library, 1–5) on cards, "Community rating" sort, subject/author/collection filters, highlights, grid ⇄ wall toggle.
- User collections: create/assign/unassign from the book page; filter shelves by collection.
- Book page: community rating fact, collections row, author links to the shelf filtered by that author.

## Non-Goals

- Reading progress tracking (current page / percent) — explicitly cancelled by the user.
- Renaming or deleting collections, or any collection management screen. Empty collections are simply hidden.
- Ratings from Google Books, Amazon, Goodreads or Hardcover (Google data is near-empty; Amazon/Goodreads have no usable API).
- Persisting the grid/wall choice anywhere but the URL.
- Sticky section headers.
- Changes to the home page or its stats charts.

## Acceptance Criteria

- [ ] Library default view shows sections: Reading → each finish year (newest first) → No date → Abandoned, each year with "N books · N pages · avg N" summary.
- [ ] Status chips show counts consistent with the other active filters; clicking one filters via the URL.
- [ ] Subject, Collection and Sort selects plus a removable author chip filter both shelves via URL params; invalid params are ignored.
- [ ] Highlights strip shows on both shelves when no filter is active and hides when any filter is active.
- [ ] Grid ⇄ wall toggle works on both shelves; wall shows covers only (title fallback for coverless books), accessible labels.
- [ ] Wishlist cards show "4.3/5 · 444 ratings" (only when ≥ 5 ratings), visually distinct from the user's own 10-star rating; "Community rating" sort exists on wishlist only.
- [ ] Community ratings are fetched in the background when a book is added and on wishlist/book page views (≤ 5 stale books per view, sequential), and appear on the next render.
- [ ] On a book page the user can add the book to an existing or new collection and remove it, saved instantly; collection badges link to the shelf filtered by that collection.
- [ ] Filtered empty state offers "Clear filters".
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build:ci` pass.

## Assumptions

- Shelves are personal-sized (hundreds of books), so loading the whole shelf and filtering in JS is fine.
- Open Library `search.json?q=<title> <author>&limit=1` finds the right work for books from any provider (verified live for subtitled Google titles, translated titles, and special characters).
- `after()` from `next/server` is available in Next 16.1.6 Server Components and Server Actions (verified in installed source).

## Technical Constraints

- Next.js 16 App Router, React 19, Drizzle ORM 0.44 + drizzle-kit 0.31, Postgres, Tailwind v4, shadcn/ui (new-york). UI copy is English.
- Schema changes: run `pnpm db:generate` then `pnpm db:migrate`. NEVER run `drizzle push` / `pnpm db:push` / `pnpm db:dev` / `pnpm db:reset`.
- Non-BetterAuth ID columns are UUID with `defaultRandom()`.
- Every query/action is scoped by `userId` (see comment at top of `src/lib/actions/books.ts`).
- Follow DESIGN.md and the live tokens in `src/app/globals.css` (warm theme, `font-display` for headings, `--star` gold reserved for the user's own rating).
- tsconfig is strict with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
- Unit tests use `node:test` via `pnpm test` (`node --experimental-strip-types`). Files under test must use relative imports with explicit `.ts` extensions (e.g. `import { x } from "./books.ts"`), not the `@/` alias, for any runtime (non-type) import.
- Filter/sort/view state lives in URL search params (existing pattern in `src/components/books/shelf-toolbar.tsx`).
