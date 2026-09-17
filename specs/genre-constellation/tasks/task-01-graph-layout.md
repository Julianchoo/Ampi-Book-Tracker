# Task 01: Graph model, server-side layout, query

## Status

complete

## Wave

1

## Description

Builds the data behind the home page "reading map": turns the user's books (library + wishlist) and their messy subject strings into a clean genre graph, computes a deterministic force layout on the server with d3-force, and exposes a query + a single `getReadingMap(userId)` entry point the home page calls. A parallel task (task-02) builds the UI against the exact type contract below, so the exported names and shapes must match exactly.

## Dependencies

**Depends on:** None (Wave 1)
**Blocks:** None (task-02 runs in parallel against the contract)

**Context from dependencies:** None. Existing code you build on: `src/lib/shelf.ts` has a private `SUBJECT_STOPLIST` / `isNoiseSubject` (used by `topSubjects`); `src/lib/books.ts` has `coverUrls(olKey, coverId, size)`; `src/lib/queries.ts` holds Drizzle queries (every query scoped by `userId`).

## Files to Create

- `src/lib/constellation.ts` — types (the contract) + pure `buildGenreGraph`
- `src/lib/constellation.test.ts` — node:test tests
- `src/lib/constellation-layout.ts` — d3-force layout + `getReadingMap` (server-only)

## Files to Modify

- `src/lib/shelf.ts` — export `isNoiseSubject`
- `src/lib/queries.ts` — add `getConstellationBooks`
- `package.json` / `pnpm-lock.yaml` — `pnpm add d3-force` and `pnpm add -D @types/d3-force`

## Technical Details

Tests run with `pnpm test` = `node --experimental-strip-types --test "src/**/*.test.ts"`: runtime imports in `constellation.ts` must be relative with `.ts` (`import { isNoiseSubject } from "./shelf.ts"`). `constellation-layout.ts` imports `d3-force` and `@/lib/queries`, so it is NOT imported by the test. tsconfig: strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.

### Type contract — `src/lib/constellation.ts` (task-02 imports these; do not rename)

```ts
/** Input: the fields the map needs, nothing private (no notes/description). */
export type MapBookInput = {
  id: string;
  title: string;
  author: string | null;
  olKey: string;
  coverId: number | null;
  subjects: string[] | null;
  shelf: string;            // "library" | "wishlist"
  status: string | null;
  rating: number | null;    // own rating 0.5–10
  olRating: number | null;  // Open Library 1–5
  olRatingCount: number | null;
};

export type GenreNode = {
  kind: "genre";
  id: string;              // "fiction", "fiction/thrillers", "other"
  label: string;           // display label, e.g. "Thrillers"
  depth: 0 | 1;
  parentId: string | null; // depth-1 → its depth-0 id
  bookCount: number;       // distinct books linked to it or its children
  x: number; y: number; r: number; // filled by layout (0 before)
};

export type BookNode = {
  kind: "book";
  id: string;
  title: string;
  author: string | null;
  shelf: "library" | "wishlist";
  status: string | null;
  rating: number | null;
  olRating: number | null;
  olRatingCount: number | null;
  cover: string[];         // coverUrls(olKey, coverId, "M") — detail panel
  thumb: string[];         // coverUrls(olKey, coverId, "S") — full-map cover (Google: /api/cover/[id]?size=small)
  genreIds: string[];      // 1–2 genre ids this book links to
  x: number; y: number; r: number;
};

export type MapLink = { source: string; target: string; kind: "parent" | "book" };

export type ReadingMap = {
  width: number;   // viewBox width (1000)
  height: number;  // viewBox height (720)
  genres: GenreNode[];
  books: BookNode[];
  links: MapLink[];
  /** Ids of the up-to-6 genres with the most books (labels in the preview). */
  topGenreIds: string[];
};

export function buildGenreGraph(books: MapBookInput[]): Omit<ReadingMap, "width" | "height"> | null;
```

### Graph rules (`buildGenreGraph`) — validated against the real data (prototype gave 20 genres, 81 book links, 14 parent links, hubs fiction 28 / literary 11 / thrillers 7 / sci-fi 6 / mystery 5)

1. **Normalise each subject** of a book:
   - skip if `isNoiseSubject(subject)` (export it from shelf.ts; keep its current behaviour);
   - split on `/` (trim segments, drop empty), drop any segment equal (case-insensitive) to `"general"`;
   - apply a **synonym map** for flat subjects (key lowercased whole subject → path): `"literary fiction"→["Fiction","Literary"]`, `"literary"→["Fiction","Literary"]`, `"thriller"`/`"thrillers"`/`"suspense"→["Fiction","Thrillers"]`, `"horror"→["Fiction","Horror"]`, `"science fiction"`/`"sci-fi"→["Fiction","Science Fiction"]`, `"fantasy"→["Fiction","Fantasy"]`, `"historical fiction"→["Fiction","Historical"]`, `"mystery"`/`"detective and mystery stories"→["Fiction","Mystery & Detective"]`, `"memoir"`/`"memoirs"→["Biography & Autobiography","Memoirs"]`, `"biography"→["Biography & Autobiography"]`, `"essays"→["Literary Collections","Essays"]`. Also map path segment 2 `"Thrillers"` and `"Suspense"` under Fiction both to `"Thrillers"` (so "Fiction / Thrillers / Suspense" and "... / Psychological" merge).
   - keep only the first 2 segments; id = segments lowercased joined by `/`.
2. **Per book**, dedupe paths; drop a path if the same book also has a longer path that starts with it (e.g. drop `fiction` when `fiction/literary` exists).
3. **Count** books per path (a depth-1 path also counts toward its depth-0 parent, each book once).
4. **Qualify**: a genre exists only if bookCount ≥ 2. For each book path whose node doesn't qualify, fall back to its parent if the parent qualifies; otherwise drop the path. A depth-0 node exists if it qualifies itself or has a qualifying child.
5. **Links per book**: at most 2 distinct genre ids, preferring deeper (depth 1) then higher bookCount, then id. Books left with no genre link to an `"other"` genre (label `"Other"`, depth 0) — create it only if at least one book needs it.
   After the cap, **re-qualify** once on the capped links: a genre left with < 2 books is dropped; its books move to the parent if the parent still qualifies, else to `"other"`.
6. **Labels**: the most frequent original casing for that segment across the data (ties: first seen); synonym-mapped labels use the map's casing.
7. **Parent links** `{ source: parentId, target: childId, kind: "parent" }`; **book links** `{ source: genreId, target: bookId, kind: "book" }`.
8. Recompute final `bookCount` after fallbacks/caps (distinct books whose `genreIds` include the node or one of its children).
9. `topGenreIds`: up to 6 genre ids by bookCount desc, then id.
10. Return `null` if fewer than 3 books have a non-"other" genre.
11. Sort `genres` and `books` by id for determinism. `cover` = `coverUrls(olKey, coverId, "M")` and `thumb` = `coverUrls(olKey, coverId, "S")` (import from `./books.ts`; size `"S"` maps a Google proxy url to `?size=small`, which `next.config.ts` allows via `images.localPatterns`). `shelf` normalised to `"library" | "wishlist"`.

### Layout — `src/lib/constellation-layout.ts`

```ts
import "server-only"; // only if the package exists in node_modules; otherwise omit
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";

export function layoutReadingMap(graph: Omit<ReadingMap, "width" | "height">): ReadingMap;
export async function getReadingMap(userId: string): Promise<ReadingMap | null>; // query → build → layout
```
- Radii: genre `r = 10 + 4 * Math.sqrt(bookCount)` (depth 0 gets +4); book `r = 4.5` (the dot radius).
- Simulation nodes: genres + books in id order (stable input = deterministic output with d3-force's default seeded random). `forceLink(links).id(d => d.id)` with distance 46 for book links (wider than a dot needs, so the full map's covers have room), 90 for parent links, strength 0.9/0.4; `forceManyBody().strength(d => d.kind === "genre" ? -380 : -28)`; `forceCollide(d => d.kind === "genre" ? d.r + 18 : 20)` (books collide as if 26×39 covers, not 4.5px dots); weak `forceX(0)`/`forceY(0)` strength 0.06. `.stop()` then `.tick(400)`.
- Fit to viewBox 1000×720 with 48px padding preserving aspect ratio (scale uniformly, centre); round x/y to 1 decimal.
- `getReadingMap`: `getConstellationBooks(userId)` → `buildGenreGraph` → null or `layoutReadingMap`.

### Query — `src/lib/queries.ts`

```ts
/** Both shelves, only the fields the reading map shows (no notes/description reach the client). */
export async function getConstellationBooks(userId: string): Promise<MapBookInput[]>
```
Select exactly the `MapBookInput` fields from `book` where `userId`. Use `import type { MapBookInput } from "@/lib/constellation"`.

### Tests (`src/lib/constellation.test.ts`)

Factory `book(overrides)`. Cover: general-dropping and 2-level truncation; synonym merge ("Literary Fiction" + "Fiction / Literary" → one node); prefix dropping per book; ≥2 qualification with fallback to parent; "other" creation; max 2 links preferring depth; bookCount distinct; topGenreIds order/cap; null when < 3 books; determinism (same input → deep-equal output). Optionally a layout smoke test is NOT required (d3 import).

### Verify

`pnpm test`, `pnpm lint`, `pnpm typecheck`. Then a throwaway script in `C:\Users\julia\AppData\Local\Temp\claude\c--Users-julia-Python-Juli-Book-Tracker\e42cb415-fb3a-4627-bd0a-ba121a3fce23\scratchpad` (not the repo) that reads the real books read-only (repo `postgres` package, `POSTGRES_URL` from `.env`, never print it) and prints genre count, links, top hubs and whether all x/y are within the viewBox. Typecheck errors in files owned by task-02 (`src/components/books/reading-map*.tsx`, `src/app/page.tsx`) are not yours.

## Acceptance Criteria

- [ ] Contract types and function names exported exactly as above.
- [ ] Real data yields roughly 20 genres with fiction ≈ 28 books as largest hub (report actual numbers).
- [ ] Layout deterministic, all nodes inside 1000×720, no overlapping genre nodes.
- [ ] `d3-force` only imported from `constellation-layout.ts` (server).
- [ ] Tests pass; lint + typecheck clean for owned files.
