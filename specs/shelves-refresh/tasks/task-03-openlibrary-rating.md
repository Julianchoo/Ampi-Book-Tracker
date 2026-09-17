# Task 03: Open Library community rating client

## Status

complete

## Wave

1

## Description

The wishlist will show an outside reference rating for each book, sourced from Open Library (free, no key; Google Books ratings were verified to be near-empty). This task adds a small client function that looks up a book's community rating by title + author, plus pure parse helpers with unit tests. It does not store anything — task-04 does that in the background.

## Dependencies

**Depends on:** None (Wave 1)
**Blocks:** task-04-queries-ratings.md

**Context from dependencies:** None.

## Files to Create

- `src/lib/openlibrary.test.ts` — node:test tests for the pure helpers

## Files to Modify

- `src/lib/openlibrary.ts` — add rating lookup

## Technical Details

Tests run with `node --experimental-strip-types --test` — `openlibrary.ts` only has `import type` from `@/lib/books` (erased), so the test can `import { ... } from "./openlibrary.ts"`. Do not add runtime `@/` imports to openlibrary.ts.

### Findings from live probing (do not re-litigate)

- Do NOT use `https://openlibrary.org/works/<id>/ratings.json`: it returns `{"average":0,"count":0}` identically for unrated works, nonexistent works and redirect stubs.
- Do NOT use `search.json?title=&author=`: Google titles look like "Project Hail Mary: A Novel" → `numFound: 0`; English titles of translations match the wrong work.
- DO use one free-text query for every provider (google:, manual:, /works/): `https://openlibrary.org/search.json?q=<title> <author>&fields=key,ratings_average,ratings_count&limit=1`. Verified correct for subtitled titles, translations ("One Hundred Years of Solitude" → Cien años de soledad, 89 ratings), and titles with `(` or `"`.
- Unrated docs OMIT `ratings_average` / `ratings_count` (they are not 0). Parse `ratings_count ?? 0`.
- Open Library takes ~0.75–1.2s per request and may hang; rate limit 1 req/s.

### Code

```ts
export type CommunityRating = { average: number | null; count: number };

/** The free-text query. Title + author, whitespace collapsed. */
export function ratingQuery(title: string, author: string | null | undefined): string {
  return `${title} ${author ?? ""}`.replace(/\s+/g, " ").trim();
}

/**
 * Reads the first search doc. No docs, or a doc with no ratings, is a real
 * answer ("nobody has rated this"), so it returns count 0 rather than null.
 */
export function parseRatingSearch(json: unknown): CommunityRating {
  // docs?: { ratings_average?: number; ratings_count?: number }[]
  // count = integer >= 0 (non-numbers -> 0); average = count > 0 && finite number ? value : null
}

/**
 * Community rating for a book. Null means "couldn't ask" (network error,
 * timeout, non-2xx) so the caller retries later; { count: 0 } means
 * Open Library answered and has nothing.
 */
export async function getOpenLibraryRating(book: {
  title: string;
  author: string | null;
}): Promise<CommunityRating | null> {
  // fetch with: cache: "no-store" (result is persisted by the caller, and this
  // runs inside after() where the data cache adds nothing),
  // headers: { "User-Agent": "BookTracker/1.0 (personal reading tracker)" },
  // signal: AbortSignal.timeout(TIMEOUT_MS)   // existing 8000 constant
  // try/catch -> null on throw; !res.ok -> null; else parseRatingSearch(await res.json())
}
```
URL: `` `https://openlibrary.org/search.json?q=${encodeURIComponent(ratingQuery(title, author))}&fields=key,ratings_average,ratings_count&limit=1` ``.

Match the file's existing comment style (short "why" comments). Place the new code after `getWorkDetail`.

### Tests (`src/lib/openlibrary.test.ts`)

- `ratingQuery` collapses whitespace and handles null author.
- `parseRatingSearch`: `{docs:[{ratings_average:4.5,ratings_count:178}]}` → `{average:4.5,count:178}`; `{docs:[{key:"/works/X"}]}` → `{average:null,count:0}`; `{docs:[]}` and `{}` and `null` → `{average:null,count:0}`; `{docs:[{ratings_average:0,ratings_count:0}]}` → `{average:null,count:0}`.
- Also `cleanSubjects` already exists untested — no need to add tests for it.

## Acceptance Criteria

- [ ] `getOpenLibraryRating`, `parseRatingSearch`, `ratingQuery`, `CommunityRating` exported from `src/lib/openlibrary.ts`.
- [ ] Network failure / timeout / non-2xx → `null`; valid response → `CommunityRating`.
- [ ] `node --experimental-strip-types --test src/lib/openlibrary.test.ts` passes.
- [ ] Optional sanity check: a throwaway script (not committed) calling `getOpenLibraryRating({title:"Project Hail Mary: A Novel", author:"Andy Weir"})` returns count > 100.
- [ ] `pnpm lint` clean for changed files.
