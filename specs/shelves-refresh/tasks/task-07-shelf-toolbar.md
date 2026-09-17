# Task 07: Shelf toolbar (status chips, filters, sort) + view toggle

## Status

complete

## Wave

2

## Description

Replaces the shelf toolbar's status select with status chips that show counts, adds Subject and Collection filters, a removable author chip, per-shelf sort options, and a separate grid/wall view toggle. All state stays in URL search params (the server page re-renders), following the existing pattern in `shelf-toolbar.tsx`.

## Dependencies

**Depends on:** task-02-shelf-logic.md
**Blocks:** task-09-shelf-pages.md

**Context from dependencies:** task-02 added:
- `src/lib/books.ts`: `SORTS` (labels, now incl. `community: "Community rating"`), `SHELF_SORTS: Record<Shelf, readonly SortKey[]>` (library: recent,title,author,rating,finished,added,year; wishlist: added,title,author,community,year), `DEFAULT_SORT`, `VIEWS`/`View` (`"grid" | "wall"`), `STATUSES`, `STATUS_LABELS`.
- `src/lib/shelf.ts`: `type ShelfFilters = { status: Status | undefined; subject: string | undefined; author: string | undefined; collection: string | undefined; sort: SortKey; view: View }` and `type StatusCounts = { all; reading; finished; abandoned }` (numbers). URL param names are exactly `status`, `subject`, `author`, `collection`, `sort`, `view`.

IMPORTANT for client bundles: import only from `@/lib/books` and `import type` from `@/lib/shelf` in these client files — never import `@/lib/queries` (pulls the Postgres driver into the browser).

## Files to Create

- `src/components/books/use-set-param.ts` — shared URL-param setter hook
- `src/components/books/view-toggle.tsx` — grid/wall toggle

## Files to Modify

- `src/components/books/shelf-toolbar.tsx` — rewrite

## Technical Details

Read DESIGN.md, `src/app/globals.css`, current `shelf-toolbar.tsx`, `src/components/ui/select.tsx`, and the `RangeToggle` in `src/components/books/reading-stats.tsx` (the existing aria-pressed toggle pattern — "two buttons rather than tabs: there is no second panel"). Do NOT use `ui/tabs` for chips: Radix tabs activate on arrow-key focus, which would fire a navigation per keypress.

### use-set-param.ts

```ts
"use client";
/** Returns set(key, value): "all"/""/undefined deletes the param. router.replace, scroll: false. */
export function useSetParam(): (key: string, value: string | undefined) => void
```
Move the existing `setParam` body from shelf-toolbar.tsx into this hook (usePathname, useRouter, useSearchParams, URLSearchParams, `router.replace(qs ? \`${pathname}?${qs}\` : pathname, { scroll: false })`).

### view-toggle.tsx

```tsx
"use client";
export function ViewToggle({ view }: { view: View })
```
`role="group" aria-label="View"` wrapper styled like `RangeToggle` (`inline-flex rounded-md border bg-card p-0.5 shadow-xs`). Two icon buttons (`size-8`, `aria-pressed`, `aria-label` "Grid view" / "Cover wall"): Lucide `LayoutGrid` and `Grid3x3` (`size-4`). Active: `bg-primary text-primary-foreground`; inactive: `text-muted-foreground hover:bg-accent`. Clicking grid deletes `view`; wall sets `view=wall`. The page places this next to the `h1` (task-09), not inside the toolbar.

### shelf-toolbar.tsx

```tsx
"use client";
export function ShelfToolbar({ shelf, filters, counts, subjects, collections, count }: {
  shelf: Shelf;
  filters: ShelfFilters;
  counts: StatusCounts | null;          // library: chips; wishlist: null
  subjects: string[];                   // top subjects; hide Subject select when empty
  collections: { id: string; name: string }[]; // hide Collection select when empty
  count: number;                        // number of visible books (shown on wishlist only)
})
```
Layout — `space-y-3`:

**Row 1** `flex flex-wrap items-center gap-2`:
- Library (`counts` non-null): status chips as plain `<button type="button" aria-pressed>` inside `role="group" aria-label="Filter by status"`: `All {counts.all}`, `Reading {n}`, `Finished {n}`, `Abandoned {n}` (labels from `STATUS_LABELS`). Chip classes: `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors`; active `bg-primary text-primary-foreground border-primary`; inactive `bg-background hover:bg-accent`; the number in `tabular-nums` with lower opacity (`opacity-70`). "All" deletes `status`.
- Wishlist (`counts` null): `<p className="text-sm text-muted-foreground">{count} {count === 1 ? "book" : "books"}</p>`.
- If `filters.author`: a removable chip `by {author}` + Lucide `X` (`size-3.5`), `aria-label={\`Remove author filter: ${author}\`}`, styled as an active-outline chip (`rounded-full border border-primary/40 text-primary h-8 px-3 text-sm`), click deletes `author`.

**Row 2** `flex flex-wrap gap-2`, each Select trigger `size="sm"` with `className="min-w-0 flex-1 basis-36 lg:flex-none lg:w-48"`:
- Subject select (only if `subjects.length`): `aria-label="Filter by subject"`, first item `all` → "All subjects", then subjects. Value `filters.subject ?? "all"`. If the current `filters.subject` isn't in `subjects` (it came from a URL), still include it as an item so the trigger shows it.
- Collection select (only if `collections.length`): `aria-label="Filter by collection"`, `all` → "All collections", items by id with name. Same "include current" rule is unnecessary (an unknown id just shows "All collections" — acceptable).
- Sort select: `aria-label="Sort books"`, items from `SHELF_SORTS[shelf]` with `SORTS[key]` labels. Selecting `DEFAULT_SORT[shelf]` deletes `sort`.

Keep the explanatory header comment from the current file (URL state, no client store).

## Acceptance Criteria

- [ ] Status chips are aria-pressed buttons with counts, update `status` in the URL, render only on library.
- [ ] Author chip appears only with an author filter and removes it.
- [ ] Subject/Collection selects hidden when there are no options; set/delete their params.
- [ ] Sort options come from `SHELF_SORTS[shelf]`; "Community rating" appears on wishlist only.
- [ ] `ViewToggle` toggles `view` param with accessible pressed state.
- [ ] At 375px width, chips wrap cleanly and selects wrap 2+1 without horizontal page scroll.
- [ ] No imports of `@/lib/queries` or `@/lib/db` in these client files; `pnpm lint` clean; typecheck clean for these files (the pages' old ShelfToolbar usage breaking is expected until task-09).
