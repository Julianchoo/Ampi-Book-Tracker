"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ratingSchema, shelfSchema, statusSchema, type Shelf } from "@/lib/books";
import { SOURCES } from "@/lib/books";
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
  source: z.enum(SOURCES).default("openlibrary"),
  coverId: z.number().int().positive().nullish(),
  description: z.string().max(20000).nullish(),
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
      source: d.source,
      coverId: d.coverId ?? null,
      description: d.description ?? null,
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

/**
 * Edit the user's own fields on a book: rating, dates, status, notes, shelf.
 * Returns the shelf the book ended up on — finishing can move it.
 */
export async function updateBook(
  id: string,
  input: unknown
): Promise<{ ok: true; shelf: Shelf } | { ok: false; error: string }> {
  const session = await requireAuth();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Unknown book." };
  }

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const values = { ...parsed.data, updatedAt: new Date() };

  // A finish date means the book is finished. An explicit status in the same
  // call still wins — someone marking a book abandoned on the day they gave up
  // means abandoned.
  if (parsed.data.finishedAt && parsed.data.status === undefined) {
    values.status = "finished";
  }

  if (values.status === "finished") {
    const [current] = await db
      .select({ finishedAt: book.finishedAt, shelf: book.shelf })
      .from(book)
      .where(and(eq(book.id, id), eq(book.userId, session.user.id)));

    // Finishing without a date is the common case — fill it in rather than
    // leaving a finished book that sorts to the bottom of the library.
    if (current && !current.finishedAt && parsed.data.finishedAt === undefined) {
      values.finishedAt = new Date().toISOString().slice(0, 10);
    }
    // You can't finish a book you only wished for: it's read, so it's shelved.
    if (current?.shelf === "wishlist" && values.shelf === undefined) {
      values.shelf = "library";
    }
  }

  const updated = await db
    .update(book)
    .set(values)
    .where(and(eq(book.id, id), eq(book.userId, session.user.id)))
    .returning({ shelf: book.shelf });

  if (!updated[0]) return { ok: false, error: "Unknown book." };
  refresh(id);
  return { ok: true, shelf: updated[0].shelf as Shelf };
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
