"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ratingSchema, shelfSchema, statusSchema } from "@/lib/books";
import { db } from "@/lib/db";
import { book } from "@/lib/schema";
import { requireAuth } from "@/lib/session";

/*
 * Every statement below is scoped by `userId` as well as `id`. A bare
 * `eq(book.id, id)` would let anyone with a guessed uuid read or edit another
 * account's shelf, so the pairing is not optional anywhere in this file.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const addSchema = z.object({
  olKey: z.string().min(1),
  title: z.string().min(1).max(500),
  author: z.string().max(300).nullish(),
  coverId: z.number().int().positive().nullish(),
  firstPublishYear: z.number().int().min(0).max(2200).nullish(),
  pages: z.number().int().positive().max(100000).nullish(),
  language: z.string().max(20).nullish(),
  subjects: z.array(z.string().max(60)).max(12).optional(),
  shelf: shelfSchema,
});

const updateSchema = z
  .object({
    status: statusSchema.nullable(),
    rating: ratingSchema.nullable(),
    startedAt: dateString.nullable(),
    finishedAt: dateString.nullable(),
    notes: z.string().max(10000).nullable(),
    shelf: shelfSchema,
  })
  .partial();

function refresh(id?: string) {
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/wishlist");
  if (id) revalidatePath(`/books/${id}`);
}

/** Add a search result to a shelf. Returns the new book's id. */
export async function addBook(
  input: unknown
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await requireAuth();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That book couldn't be read." };

  const d = parsed.data;
  // A book already on a shelf just moves; the unique index makes this safe
  // against a double-click racing itself.
  const [row] = await db
    .insert(book)
    .values({
      userId: session.user.id,
      olKey: d.olKey,
      title: d.title,
      author: d.author ?? null,
      coverId: d.coverId ?? null,
      firstPublishYear: d.firstPublishYear ?? null,
      pages: d.pages ?? null,
      language: d.language ?? null,
      subjects: d.subjects ?? [],
      shelf: d.shelf,
      status: d.shelf === "library" ? "reading" : null,
      startedAt:
        d.shelf === "library" ? new Date().toISOString().slice(0, 10) : null,
    })
    .onConflictDoUpdate({
      target: [book.userId, book.olKey],
      set: { shelf: d.shelf, updatedAt: new Date() },
    })
    .returning({ id: book.id });

  if (!row) return { ok: false, error: "Couldn't save that book." };
  refresh(row.id);
  return { ok: true, id: row.id };
}

/** Edit the user's own fields on a book: rating, dates, status, notes, shelf. */
export async function updateBook(
  id: string,
  input: unknown
): Promise<ActionResult> {
  const session = await requireAuth();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Unknown book." };
  }

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const values = { ...parsed.data, updatedAt: new Date() };

  // Finishing a book without a date is the common case — fill it in rather
  // than leaving a finished book that sorts to the bottom of the library.
  if (parsed.data.status === "finished" && parsed.data.finishedAt === undefined) {
    const [current] = await db
      .select({ finishedAt: book.finishedAt })
      .from(book)
      .where(and(eq(book.id, id), eq(book.userId, session.user.id)));
    if (current && !current.finishedAt) {
      values.finishedAt = new Date().toISOString().slice(0, 10);
    }
  }

  const updated = await db
    .update(book)
    .set(values)
    .where(and(eq(book.id, id), eq(book.userId, session.user.id)))
    .returning({ id: book.id });

  if (updated.length === 0) return { ok: false, error: "Unknown book." };
  refresh(id);
  return { ok: true };
}

/** Move a wishlist book onto the library shelf and start reading it today. */
export async function moveToLibrary(id: string): Promise<ActionResult> {
  const session = await requireAuth();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Unknown book." };
  }

  const moved = await db
    .update(book)
    .set({
      shelf: "library",
      status: "reading",
      startedAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date(),
    })
    .where(and(eq(book.id, id), eq(book.userId, session.user.id)))
    .returning({ id: book.id });

  if (moved.length === 0) return { ok: false, error: "Unknown book." };
  refresh(id);
  return { ok: true };
}

export async function deleteBook(id: string): Promise<ActionResult> {
  const session = await requireAuth();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Unknown book." };
  }

  const removed = await db
    .delete(book)
    .where(and(eq(book.id, id), eq(book.userId, session.user.id)))
    .returning({ id: book.id });

  if (removed.length === 0) return { ok: false, error: "Unknown book." };
  refresh();
  return { ok: true };
}
