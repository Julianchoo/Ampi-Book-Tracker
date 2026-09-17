# Task 08: Book page — collections picker, community rating fact, author link

## Status

pending

## Wave

3

## Description

The book detail page becomes where collections are managed and where the Open Library community rating is shown for books on either shelf. The author name links to the book's shelf filtered by that author (this is how author filtering is reached). Viewing the page also refreshes a stale community rating in the background.

## Dependencies

**Depends on:** task-02-shelf-logic.md, task-04-queries-ratings.md, task-05-collection-actions.md
**Blocks:** None

**Context from dependencies:**
- task-01 (via task-04): `Book` rows now have `olRating` (1–5 | null), `olRatingCount` (number | null), `olRatingCheckedAt` (Date | null).
- task-02, `src/lib/shelf.ts`: `hasCommunityRating({ olRating, olRatingCount })` (count ≥ 5), `pickStaleForRating(books)` (returns those never checked or checked > 30 days ago, max 5).
- task-04, `src/lib/queries.ts`: `getBookCollections(userId, bookId): Promise<{ id; name }[]>` (collections this book is in), `getUserCollections(userId): Promise<{ id; name }[]>` (all non-empty collections, sorted). `src/lib/ratings.ts`: `refreshRatings(userId, books: { id; title; author }[])` — background-safe, must be called inside `after()`, never awaited in render.
- task-05, `src/lib/actions/collections.ts` (server actions): `addBookToCollection(bookId, name)` → `{ ok: true, collection: { id, name } } | { ok: false, error }` (creates the collection if needed, case-insensitive reuse); `removeBookFromCollection(bookId, collectionId)` → `{ ok: true } | { ok: false, error }`. Both revalidate `/library`, `/wishlist`, `/books/{id}`.
- Shelf URL params (task-02/07): `/library?collection=<uuid>`, `/wishlist?author=<name>` etc.

## Files to Create

- `src/components/books/collection-picker.tsx` — client component

## Files to Modify

- `src/app/books/[id]/page.tsx`

## Technical Details

Read DESIGN.md, `src/app/globals.css`, `src/components/ui/{popover,command,badge,button}.tsx`, and the current page. UI copy English. Toasts via `sonner` (`import { toast } from "sonner"`), like other client components in `src/components/books/` (check `start-reading-button.tsx` for the pattern with `useTransition`).

### page.tsx changes

1. After `getBook`, fetch in parallel: `const [bookCollections, allCollections] = await Promise.all([getBookCollections(session.user.id, book.id), getUserCollections(session.user.id)])`.
2. Background rating refresh (capture values first; no request APIs inside the callback):
   ```ts
   import { after } from "next/server";
   const stale = pickStaleForRating([book]);
   if (stale.length) {
     const userId = session.user.id;
     after(() => refreshRatings(userId, stale.map(({ id, title, author }) => ({ id, title, author }))));
   }
   ```
3. Facts: after "Pages", add when `hasCommunityRating(book)`: `{ label: "Community rating", value: \`${book.olRating!.toFixed(1)}/5 (${book.olRatingCount!.toLocaleString("en-GB")})\` }`. Plain text in the `dl` — no stars, no gold.
4. Author: wrap in `Link` to `` `/${book.shelf === "wishlist" ? "wishlist" : "library"}?author=${encodeURIComponent(book.author)}` `` with `hover:underline` (keep `text-base text-muted-foreground`), and a `title="More by this author"`-style hint is fine but not required.
5. Insert `<CollectionPicker bookId={book.id} shelf={...} assigned={bookCollections} all={allCollections} />` in its own row directly ABOVE the subjects block (currently `{subjects.length > 0 && ...}`), with `mt-6`. Keep it out of `BookDetailsForm` (that form saves with a button; collections save instantly).

### collection-picker.tsx

```tsx
"use client";
export function CollectionPicker({ bookId, shelf, assigned, all }: {
  bookId: string;
  shelf: "library" | "wishlist";
  assigned: { id: string; name: string }[];
  all: { id: string; name: string }[];
})
```
- Row `flex flex-wrap items-center gap-1.5`:
  - Each assigned collection: `Link` to `/${shelf}?collection=${id}` styled with `badgeVariants({ variant: "secondary" })` (Badge renders a div, so use the variants on the Link). Subjects use `outline`, so collections look different.
  - Button `variant="outline" size="sm"` with Lucide `Plus` + "Collection" (`aria-label="Add to collection"`), as the `PopoverTrigger asChild`.
- `PopoverContent className="w-64 p-0" align="start"` containing `Command`:
  - `CommandInput placeholder="Find or create…"` with controlled `value`/`onValueChange` (`query`).
  - `CommandList` → `CommandGroup` listing `all` (merged with `assigned` in case of stale lists, dedupe by id); each `CommandItem` shows a Lucide `Check` (`size-4`, `opacity-0` when not assigned) + name; `onSelect` toggles: assigned → `removeBookFromCollection`, else `addBookToCollection(bookId, name)`.
  - When `query.trim()` is non-empty and no collection name equals it case-insensitively: a `CommandItem` with `forceMount` (cmdk 1.1.1 supports it) and `value={\`create:${query}\`}` showing `Create “{query.trim()}”` with a `Plus` icon; `onSelect` → `addBookToCollection(bookId, query.trim())`, then clear `query`.
  - `CommandEmpty`: "No collections yet." (only visible when nothing matches and no create item).
- Use `useTransition` for pending state (disable items while pending); on `{ ok: false }` → `toast.error(result.error)`. Keep the popover open after toggling so several can be ticked; server revalidation refreshes the props.
- Optimistic UI is not required.

## Acceptance Criteria

- [ ] Book page shows collection badges (linking to the filtered shelf) and a "+ Collection" picker above subjects.
- [ ] Picker toggles membership instantly, creates new collections by typing, reports errors via toast.
- [ ] "Community rating 4.3/5 (444)" fact appears only with ≥ 5 ratings.
- [ ] Author links to the book's shelf filtered by `author`.
- [ ] Stale/never-checked rating is refreshed via `after()` without delaying render.
- [ ] Keyboard: picker reachable and operable with keyboard (Popover + Command defaults).
- [ ] `pnpm lint`, `pnpm typecheck` clean for these files.
