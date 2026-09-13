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

/** The figures that have a finished-date, so can be scoped to a year. */
export type FinishedTotals = {
  finished: number;
  avgRating: number | null;
  /** Pages summed over finished books; a book with no page count adds 0. */
  pages: number;
  /** Mean pages of the finished books that do have a page count. */
  avgPages: number | null;
};

export type ReadingStats = {
  allTime: FinishedTotals;
  thisYear: FinishedTotals;
  year: number;
  /* Present-tense counts — "how many are on that shelf right now" has no year. */
  totalReading: number;
  wishlistCount: number;
  /** One entry per month that has data, oldest first. */
  byMonth: {
    month: string;
    finished: number;
    avgRating: number | null;
    pages: number;
    avgPages: number | null;
  }[];
};

export async function getStats(userId: string): Promise<ReadingStats> {
  // Every finished-book figure is computed twice in the one pass: once over
  // everything, once over books finished since 1 January. Two FILTER clauses
  // are cheaper than two round trips, and the client can then toggle with no
  // further queries.
  const done = sql`${book.status} = 'finished' and ${book.shelf} = 'library'`;
  const thisYear = sql`${done} and ${book.finishedAt} >= date_trunc('year', current_date)::date`;

  const [counts] = await db
    .select({
      finished: sql<number>`count(*) filter (where ${done})::int`,
      avgRating: sql<number | null>`avg(${book.rating}) filter (where ${done})`,
      pages: sql<number>`coalesce(sum(${book.pages}) filter (where ${done}), 0)::int`,
      avgPages: sql<number | null>`avg(${book.pages}) filter (where ${done})`,
      yFinished: sql<number>`count(*) filter (where ${thisYear})::int`,
      yAvgRating: sql<number | null>`avg(${book.rating}) filter (where ${thisYear})`,
      yPages: sql<number>`coalesce(sum(${book.pages}) filter (where ${thisYear}), 0)::int`,
      yAvgPages: sql<number | null>`avg(${book.pages}) filter (where ${thisYear})`,
      totalReading: sql<number>`count(*) filter (where ${book.status} = 'reading' and ${book.shelf} = 'library')::int`,
      wishlistCount: sql<number>`count(*) filter (where ${book.shelf} = 'wishlist')::int`,
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
      pages: sql<number>`coalesce(sum(${book.pages}), 0)::int`,
      avgPages: sql<number | null>`avg(${book.pages})`,
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

  const num = (v: number | null | undefined) => (v != null ? Number(v) : null);

  return {
    allTime: {
      finished: counts?.finished ?? 0,
      avgRating: num(counts?.avgRating),
      pages: counts?.pages ?? 0,
      avgPages: num(counts?.avgPages),
    },
    thisYear: {
      finished: counts?.yFinished ?? 0,
      avgRating: num(counts?.yAvgRating),
      pages: counts?.yPages ?? 0,
      avgPages: num(counts?.yAvgPages),
    },
    year: new Date().getFullYear(),
    totalReading: counts?.totalReading ?? 0,
    wishlistCount: counts?.wishlistCount ?? 0,
    byMonth: rows.map((r) => ({
      month: r.month,
      finished: r.finished,
      avgRating: num(r.avgRating),
      pages: r.pages,
      avgPages: num(r.avgPages),
    })),
  };
}
