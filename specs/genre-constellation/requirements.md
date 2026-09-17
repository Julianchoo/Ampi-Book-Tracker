# Requirements: Genre Constellation (Reading Map)

## Summary

A "Your reading map" card on the signed-in home page shows the user's books (library + wishlist) as a concept map: genre nodes connected parent→child, with each book as a dot linked to up to two genres, so books visibly bridge genres. The card shows a small static preview; clicking it opens a large dialog with the full map, interaction (select book/genre, highlight connections, detail panel), zoom buttons, and a list view.

The user explicitly asked for a very beautiful interface. The home preview draws books as plain dots and never downloads a thumbnail; the full map in the dialog draws each book as a small cover (Open Library size S, or the `/api/cover/[id]?size=small` proxy for Google volumes, allowed via `localPatterns` in `next.config.ts`). A dot grows into its cover once the thumbnail has loaded and looks like a real cover; books without a usable thumbnail stay dots.

## Goals

- A readable (not hairball) genre map built from the messy real subject data.
- Server-side, deterministic layout — no d3 shipped to the browser.
- A polished, calm, on-brand visual (warm theme, font-display labels, subtle motion) that works in light and dark mode and on phones.
- Accessible alternative (list view) for keyboard and screen reader users.

## Non-Goals

- Multi-hue categorical colouring (the chart palette fails colour-vision validation; single hue + direct labels instead).
- Author or collection nodes.
- A separate /map page.

## Acceptance Criteria

- [ ] Home shows the reading map card below the stats charts when ≥ 3 books have usable subjects; hidden otherwise.
- [ ] With the user's real data the graph has ~20 genre nodes (fiction the biggest hub, ~28 books), not one giant star.
- [ ] Preview is static (no scroll hijack), labels only the top 6 genres, and the whole card opens the dialog.
- [ ] Dialog: full map with all genre labels (legible halo), books drawn as small covers (dots until/unless a thumbnail loads; library dots filled / wishlist dots hollow-dashed, wishlist covers faded with a dashed frame), select a book → highlight + detail panel with cover, title, author, rating and "Open book"; select a genre → highlight its books; zoom in/out/reset buttons, drag to pan, pinch (touch) and wheel (pointer) zoom, all clamped to the map; Map/List toggle.
- [ ] Works at 375px width and desktop, light and dark.
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build:ci` pass.

## Assumptions

- Real data: 82 books, 76 with subjects; mostly Google BISAC strings ("Fiction / General", "Fiction / Thrillers / Psychological") plus flat Open Library subjects ("Thriller", "Literary Fiction", "Soviet Union").
- d3-force v3 is deterministic by default (seeded random source) when nodes are inserted in a stable order.

## Technical Constraints

- Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui, Lucide. UI copy English. Follow DESIGN.md and live tokens in `src/app/globals.css`; `--star` gold is reserved for the user's own rating.
- Only new dependency: `d3-force` (+ `@types/d3-force` dev), used server-side only. Install with `pnpm add`.
- Pure logic tested with `node:test` via `pnpm test`; runtime imports in tested files must be relative with `.ts` extension.
- Client components must not import `@/lib/queries` / `@/lib/db`, and must receive only serializable props.
- No schema changes.
