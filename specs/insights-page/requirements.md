# Requirements: Insights page

## Summary

A new `/insights` page (linked from the header nav) with three charts about the reader's own shelf: which eras they read (publication decades), how their genres compare (bubbles positioned by their average rating, sized by books read, with a dashed ring for what is still on the wishlist), and how they rate (distribution of their own ratings). An All time / current year toggle sits at the top, matching the home stats.

The point is delight plus honesty: the charts must read well with this user's real, lopsided data rather than idealised data.

## Goals

- Show what was read, what was liked and what is still pending, in a way that is pleasant to look at.
- Reuse the existing genre normalisation (`buildGenreGraph`) rather than inventing a second genre model.
- Keep the visual language of the app: single hue, direct labels, warm theme, light + dark, phone-friendly.
- Every chart has a text equivalent for keyboard and screen reader users.

## Non-Goals

- New database columns or migrations.
- Multi-hue categorical palettes (the chart tokens fail colour-vision validation).
- Dual-axis charts of any kind.
- Editing anything from this page; it is read-only.
- Author, language or page-count charts (not asked for).

## Acceptance Criteria

- [ ] `/insights` exists, requires auth, is linked in the header nav (desktop and mobile menus) and has its own page title.
- [ ] Eras: bars per publication decade; tooltip shows count and average rating; a caption names the best- and worst-rated decade with enough books to matter.
- [ ] Genres: bubbles with x = average rating (axis fitted to the real range, clearly labelled), size = books read, dashed outer ring = wishlist books in that genre; only genres with ≥ 2 read books; the catch-all "Other" genre excluded; genres with only pending books shown in a separate "Not started yet" strip.
- [ ] Selecting a bubble opens a panel listing that genre's books (read with their rating, pending marked) linking to each book page.
- [ ] Ratings: distribution of the user's own ratings with their average marked, plus a one-line reading of it.
- [ ] All time / year toggle drives the read-side of all three charts; wishlist rings stay all-time with a footnote.
- [ ] Empty/thin states: a chart with no data is hidden or shows a short note instead of an empty frame.
- [ ] Works at 375px and desktop, light and dark; `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build:ci` pass.

## Assumptions

Real data for the main account (74 books, 19 genres from `buildGenreGraph`):

- Decades: 2020s 22, 2010s 21, 2000s 18, 1990s 8, then single books in the 1970s, 1960s, 1950s, 1940s. Average rating by decade: 1950s 9.0 (1 book), 1940s 8.5 (1), 2010s 7.5, 2000s 7.1, 1990s 7.0, 2020s 6.3.
- Genre averages sit in a narrow 5.6–7.8 band, so a 0–10 axis would bunch every bubble in the middle.
- Genres include a catch-all "Other" with 10 books, and several genres with only 1–2 books.
- Second account: 34 books, 10 genres, ratings 5.6–7.5, two genres with zero read books.

## Technical Constraints

- Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui, recharts 3.8 (already used in `src/components/books/reading-stats.tsx` with `ChartContainer` + `ResponsiveContainer`).
- Follow DESIGN.md and `src/app/globals.css`; `--star` gold is only for the user's own rating; headings use `font-display`.
- The implementer must load the `dataviz` skill before writing chart code, and the `frontend-design` skill for the page.
- Pure logic tested with `node:test` (`pnpm test`); tested files use relative `.ts` imports.
- Client components must not import `@/lib/queries` or `@/lib/db` as values, and receive only serializable props.
- Queries scoped by `userId`.
