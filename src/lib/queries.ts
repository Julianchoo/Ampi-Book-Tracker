import { cache } from "react";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type { Shelf, SortKey, Status } from "@/lib/books";
import { db } from "@/lib/db";
import { book } from "@/lib/schema";

export type Book = typeof book.$inferSelect;

/**
 * Default order is "latest finished, then started if not finished", which is
 * what the shelf should show without being asked. NULLS LAST matters: without
 * it Postgres sorts NULL first on DESC and unread books bury the finished ones.
 */
const ORDER_BY: Record<SortKey, SQL[]> = {
  recent: [
    sql`${book.finishedAt} DESC NULLS LAST`,
    sql`${book.startedAt} DESC NULLS LAST`,
    desc(book.createdAt),
  ],
  finished: [sql`${book.finishedAt} DESC NULLS LAST`, desc(book.createdAt)],
  title: [asc(book.title)],
  author: [sql`${book.author} ASC NULLS LAST`, asc(book.title)],
  rating: [sql`${book.rating} DESC NULLS LAST`, asc(book.title)],
  added: [desc(book.createdAt)],
  year: [sql`${book.firstPublishYear} DESC NULLS LAST`, asc(book.title)],
};

export async function getShelf(
  userId: string,
  shelf: Shelf,
  opts: { sort?: SortKey | undefined; status?: Status | undefined } = {}
): Promise<Book[]> {
  const filters = [eq(book.userId, userId), eq(book.shelf, shelf)];
  if (opts.status) filters.push(eq(book.status, opts.status));

  return db
    .select()
    .from(book)
    .where(and(...filters))
    .orderBy(...ORDER_BY[opts.sort ?? "recent"]);
}

/** Deduped: the book page and its generateMetadata both ask for the same row. */
export const getBook = cache(async function getBook(
  userId: string,
  id: string
): Promise<Book | null> {
  const [row] = await db
    .select()
    .from(book)
    .where(and(eq(book.id, id), eq(book.userId, userId)));
  return row ?? null;
});

/** The book for the home hero: most recently started, still being read. */
export async function getCurrentlyReading(userId: string): Promise<Book | null> {
  const [row] = await db
    .select()
    .from(book)
    .where(
      and(
        eq(book.userId, userId),
        eq(book.shelf, "library"),
        eq(book.status, "reading")
      )
    )
    .orderBy(sql`${book.startedAt} DESC NULLS LAST`, desc(book.createdAt))
    .limit(1);
  return row ?? null;
}

export type ReadingStats = {
  totalFinished: number;
  totalReading: number;
  wishlistCount: number;
  avgRating: number | null;
  /** One entry per month that has data, oldest first. */
  byMonth: { month: string; finished: number; avgRating: number | null }[];
};

export async function getStats(userId: string): Promise<ReadingStats> {
  const [counts] = await db
    .select({
      totalFinished: sql<number>`count(*) filter (where ${book.status} = 'finished' and ${book.shelf} = 'library')::int`,
      totalReading: sql<number>`count(*) filter (where ${book.status} = 'reading' and ${book.shelf} = 'library')::int`,
      wishlistCount: sql<number>`count(*) filter (where ${book.shelf} = 'wishlist')::int`,
      avgRating: sql<number | null>`avg(${book.rating}) filter (where ${book.rating} is not null)`,
    })
    .from(book)
    .where(eq(book.userId, userId));

  // Grouped in SQL rather than in JS: the shelf can grow without this getting
  // slower, and Postgres already knows how to bucket dates.
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${book.finishedAt}), 'YYYY-MM')`,
      finished: sql<number>`count(*)::int`,
      avgRating: sql<number | null>`avg(${book.rating})`,
    })
    .from(book)
    .where(
      and(
        eq(book.userId, userId),
        eq(book.status, "finished"),
        sql`${book.finishedAt} is not null`
      )
    )
    .groupBy(sql`date_trunc('month', ${book.finishedAt})`)
    .orderBy(sql`date_trunc('month', ${book.finishedAt}) asc`);

  return {
    totalFinished: counts?.totalFinished ?? 0,
    totalReading: counts?.totalReading ?? 0,
    wishlistCount: counts?.wishlistCount ?? 0,
    avgRating: counts?.avgRating != null ? Number(counts.avgRating) : null,
    byMonth: rows.map((r) => ({
      month: r.month,
      finished: r.finished,
      avgRating: r.avgRating != null ? Number(r.avgRating) : null,
    })),
  };
}
