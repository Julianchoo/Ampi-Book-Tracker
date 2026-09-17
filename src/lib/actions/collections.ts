"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { book, bookCollection, collection } from "@/lib/schema";
import { requireAuth } from "@/lib/session";

/*
 * Same rule as books.ts: every statement is scoped by the session user, so a
 * guessed book or collection uuid never reaches another account's rows.
 */

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name the collection.")
  .max(60, "Keep it under 60 characters.");
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
): Promise<
  { ok: true; collection: { id: string; name: string } } | { ok: false; error: string }
> {
  const session = await requireAuth();
  const userId = session.user.id;

  if (!idSchema.safeParse(bookId).success) {
    return { ok: false, error: "Unknown book." };
  }
  const parsedName = nameSchema.safeParse(name);
  if (!parsedName.success) {
    return { ok: false, error: parsedName.error.issues[0]?.message ?? "Invalid name." };
  }
  const cleanName = parsedName.data;

  const [owned] = await db
    .select({ id: book.id })
    .from(book)
    .where(and(eq(book.id, bookId), eq(book.userId, userId)));
  if (!owned) return { ok: false, error: "Unknown book." };

  // Untargeted: Drizzle can't name the lower(name) expression index as a target.
  await db.insert(collection).values({ userId, name: cleanName }).onConflictDoNothing();

  // Case-insensitive lookup, so an existing collection keeps its original casing.
  const [row] = await db
    .select({ id: collection.id, name: collection.name })
    .from(collection)
    .where(
      and(
        eq(collection.userId, userId),
        sql`lower(${collection.name}) = lower(${cleanName})`
      )
    );
  if (!row) return { ok: false, error: "Couldn't save that collection." };

  await db
    .insert(bookCollection)
    .values({ bookId, collectionId: row.id })
    .onConflictDoNothing();

  refresh(bookId);
  return { ok: true, collection: { id: row.id, name: row.name } };
}

/** Take a book out of one collection. The collection itself stays (hidden while empty). */
export async function removeBookFromCollection(
  bookId: string,
  collectionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth();
  const userId = session.user.id;

  if (!idSchema.safeParse(bookId).success || !idSchema.safeParse(collectionId).success) {
    return { ok: false, error: "Unknown collection." };
  }

  // The subquery limits the delete to the user's own collections.
  await db
    .delete(bookCollection)
    .where(
      and(
        eq(bookCollection.bookId, bookId),
        eq(bookCollection.collectionId, collectionId),
        inArray(
          bookCollection.collectionId,
          db.select({ id: collection.id }).from(collection).where(eq(collection.userId, userId))
        )
      )
    );

  refresh(bookId);
  return { ok: true };
}
