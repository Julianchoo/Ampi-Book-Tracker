# Reading tracker

The whole application. Replaces the agentic-coding starter boilerplate.

## What it does

Search any book from Open Library, put it on one of two shelves, and record
what you thought of it.

- **Home** (`/`) — hero card for the book you most recently started, buttons to
  each shelf, and reading statistics.
- **Library** (`/library`) — books you've started, finished, or abandoned.
  Sortable and filterable.
- **Wishlist** (`/wishlist`) — books to get to. "Start reading" moves one to the
  library and dates it today.
- **Book page** (`/books/[id]`) — cover, facts, description, genres, your
  rating, dates, notes, and outbound links.

Everything except the signed-out landing page requires authentication, and all
data is scoped to the signed-in user.

## Key files

| Path | Role |
|---|---|
| [src/lib/schema.ts](../../src/lib/schema.ts) | The `book` table |
| [src/lib/books.ts](../../src/lib/books.ts) | Pure domain constants, zod schemas, formatters |
| [src/lib/openlibrary.ts](../../src/lib/openlibrary.ts) | Open Library client |
| [src/lib/queries.ts](../../src/lib/queries.ts) | Shelf reads, sorting, statistics |
| [src/lib/actions/books.ts](../../src/lib/actions/books.ts) | Server Actions (add / update / move / delete) |
| [src/app/api/books/search/route.ts](../../src/app/api/books/search/route.ts) | Typeahead search proxy |
| [src/components/books/](../../src/components/books/) | All book UI |
| [src/components/dachshund.tsx](../../src/components/dachshund.tsx) | Mascot icons |

## Data model

One table, `book`. A row is *a user's copy of a book*, carrying a snapshot of
the Open Library metadata alongside the user's own fields.

The metadata is denormalised deliberately: Open Library is a third-party
service that can be slow or unreachable, and a shelf has to render without it.
Only the long-form description is fetched live, on the book page.

Two indexes matter:

- `book_user_shelf_idx` on `(user_id, shelf)` — every shelf listing.
- `book_user_ol_key_idx`, **unique** on `(user_id, ol_key)` — stops the same
  book being added twice, and is what lets search mark a result as "already on
  your shelf".

`rating` is a `real` holding 1.0–10.0 in 0.5 steps. Halves are exactly
representable in binary floating point, so this is not the usual "never store
money in a float" trap. The half-step grid is still enforced by zod in
`ratingSchema`, because `real` would happily accept 7.31.

## Open Library

No API key, no quota. Two quirks drove the client's shape, both verified
against the live service:

1. A works record can be a **redirect stub** (`{"type":{"key":"/type/redirect"},
   "location":"/works/..."}`). `getWorkDetail` follows it once.
2. `description` is **either a string or `{type, value}`**. `readDescription`
   normalises both.

A third caught in testing: `language` lists every language the work has *an
edition* in, in no useful order — Dune's array starts `rum` (Romanian). Taking
`[0]` labelled most books with a random translation, so `pickLanguage` prefers
`eng` when present.

Search is proxied through a route handler rather than called from the browser,
so responses can be cached (`revalidate: 3600`) and each hit annotated with
whether the user already owns it.

## Security

Every read and write is scoped by `user_id` **and** `id`:

```ts
.where(and(eq(book.id, id), eq(book.userId, session.user.id)))
```

A bare `eq(book.id, id)` would let anyone with a guessed uuid read or edit
another account's shelf. Verified by signing in as one user and requesting
another's book URL — it returns the 404 page, not the row.

## Statistics

`getStats` groups by month in SQL (`date_trunc`), not in JavaScript, so the
shelf can grow without the query getting slower.

The chart is **one** chart with **one** y-axis: bars for books finished, a line
for average rating, both on a shared 0–10 scale. A second y-axis was avoided on
purpose — independently scaled axes are how dual-axis charts manufacture
correlations that aren't in the data. The shared scale is honest because a
month's finished-count is almost always within 0–10; the domain stretches if a
month ever beats it. A table view sits underneath so the numbers never depend
on colour alone.
