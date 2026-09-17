# Task 05: Collection server actions

## Status

complete

## Wave

2

## Description

Users can group books into their own collections (tags; many per book), managed from the book page. This task adds the two server actions behind that picker: add a book to a collection by name (creating the collection if needed) and remove a book from a collection. There is no rename/delete: a collection with no books is simply hidden elsewhere, and adding to the same name later reuses the row.

## Dependencies

**Depends on:** task-01-schema-migration.md
**Blocks:** task-08-book-page.md

**Context from dependencies:** task-01 added Drizzle tables in `src/lib/schema.ts`:
- `collection` — `id uuid pk defaultRandom`, `userId text` (FK user, cascade), `name text not null`, `createdAt`; unique index `collection_user_name_idx` on `(user_id, lower(name))`.
- `bookCollection` (table `book_collection`) — `bookId uuid` (FK book, cascade), `collectionId uuid` (FK collection, cascade), composite primary key.

## Files to Create

- `src/lib/actions/collections.ts`

## Files to Modify

None.

## Technical Details

Follow the patterns and the security comment in `src/lib/actions/books.ts`: `"use server"`, `requireAuth()` from `@/lib/session`, zod validation, every statement scoped by the session user, results as `{ ok: true, ... } | { ok: false; error: string }`. A `"use server"` file may only export async functions (types are fine as `export type`).

```ts
"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { book, bookCollection, collection } from "@/lib/schema";
import { requireAuth } from "@/lib/session";

const nameSchema = z.string().trim().min(1, "Name the collection.").max(60, "Keep it under 60 characters.");
const idSchema = z.string().uuid();

function refresh(bookId: string) {
  revalidatePath("/library");
  revalidatePath("/wishlist");
  revalidatePath(`/books/${bookId}`);
}

/** Put a book in the collection with this name, creating the collection if needed. */
export async function addBookToCollection(
  bookId: string,
  name: string
): Promise<{ ok: true; collection: { id: string; name: string } } | { ok: false; error: string }>

/** Take a book out of one collection. The collection itself stays (hidden while empty). */
export async function removeBookFromCollection(
  bookId: string,
  collectionId: string
): Promise<{ ok: true } | { ok: false; error: string }>
```

### addBookToCollection steps
1. `requireAuth()`; validate `bookId` with `idSchema` (→ `"Unknown book."`) and `name` with `nameSchema` (→ first issue message).
2. Confirm the book belongs to the user: select `book.id` where `id = bookId and userId = session.user.id`; none → `"Unknown book."`.
3. `db.insert(collection).values({ userId, name }).onConflictDoNothing()` — untargeted, because Drizzle can't target the `lower(name)` expression index.
4. Select the row: `where(and(eq(collection.userId, userId), sql\`lower(${collection.name}) = lower(${name})\`))`. Missing → `"Couldn't save that collection."`.
5. `db.insert(bookCollection).values({ bookId, collectionId: row.id }).onConflictDoNothing()`.
6. `refresh(bookId)`; return `{ ok: true, collection: { id: row.id, name: row.name } }` (existing casing wins if the name already existed).

### removeBookFromCollection steps
1. `requireAuth()`; validate both ids (→ `"Unknown collection."`).
2. `db.delete(bookCollection).where(and(eq(bookCollection.bookId, bookId), eq(bookCollection.collectionId, collectionId), inArray(bookCollection.collectionId, db.select({ id: collection.id }).from(collection).where(eq(collection.userId, userId)))))` — the subquery guarantees users only touch their own collections.
3. `refresh(bookId)`; return `{ ok: true }` (idempotent: removing a non-member is still ok).

## Acceptance Criteria

- [ ] Both actions exist with the exact signatures above.
- [ ] Adding with a name differing only in case reuses the existing collection; adding twice is a no-op.
- [ ] A user cannot add another user's book, nor remove from another user's collection.
- [ ] Invalid ids / names return `{ ok: false, error }` without throwing.
- [ ] Revalidates /library, /wishlist and the book page.
- [ ] `pnpm lint` clean; typecheck clean for this file.
