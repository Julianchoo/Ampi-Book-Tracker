import { cache } from "react";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { MIN_COMMUNITY_RATINGS, type Shelf, type SortKey } from "@/lib/books";
import type { MapBookInput } from "@/lib/constellation";
import { db } from "@/lib/db";
import type { InsightsBook } from "@/lib/insights";
import { monthKey } from "@/lib/months";
import { book, bookCollection, collection } from "@/lib/schema";

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
  // A 5.0 from two ratings says nothing; below the threshold a book sorts as unrated.
  community: [
    sql`case when ${book.olRatingCount} >= ${MIN_COMMUNITY_RATINGS} then ${book.olRating} end DESC NULLS LAST`,
    asc(book.title),
  ],
};

export type ShelfBookRow = Book & { collectionIds: string[] };
export type CollectionOption = { id: string; name: string };

/**
 * A whole shelf plus each book's collections, sorted in SQL. Filtering happens
 * in JS (src/lib/shelf.ts) because counts, subject facets and highlights all
 * need the unfiltered shelf anyway.
 * ponytail: whole shelf in memory; push filters into SQL if a shelf reaches thousands.
 */
export async function getShelfView(
  userId: string,
  shelf: Shelf,
  sort: SortKey
): Promise<{
  books: ShelfBookRow[];
  /** Collections with at least one book on THIS shelf, by name. */
  collections: CollectionOption[];
}> {
  const [rows, memberships] = await Promise.all([
    db
      .select()
      .from(book)
      .where(and(eq(book.userId, userId), eq(book.shelf, shelf)))
      .orderBy(...ORDER_BY[sort]),
    db
      .select({
        bookId: bookCollection.bookId,
        collectionId: collection.id,
        name: collection.name,
      })
      .from(bookCollection)
      .innerJoin(collection, eq(collection.id, bookCollection.collectionId))
      .innerJoin(book, eq(book.id, bookCollection.bookId))
      .where(
        and(
          eq(collection.userId, userId),
          eq(book.userId, userId),
          eq(book.shelf, shelf)
        )
      ),
  ]);

  const idsByBook = new Map<string, string[]>();
  const names = new Map<string, string>();
  for (const m of memberships) {
    const ids = idsByBook.get(m.bookId);
    if (ids) ids.push(m.collectionId);
    else idsByBook.set(m.bookId, [m.collectionId]);
    names.set(m.collectionId, m.name);
  }

  return {
    books: rows.map((b) => ({ ...b, collectionIds: idsByBook.get(b.id) ?? [] })),
    collections: [...names]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Collections this book is in. */
export async function getBookCollections(
  userId: string,
  bookId: string
): Promise<CollectionOption[]> {
  return db
    .select({ id: collection.id, name: collection.name })
    .from(bookCollection)
    .innerJoin(collection, eq(collection.id, bookCollection.collectionId))
    .where(and(eq(bookCollection.bookId, bookId), eq(collection.userId, userId)))
    .orderBy(sql`lower(${collection.name})`);
}

/** Every collection that has at least one book (empty ones are hidden, never deleted), by name. */
export async function getUserCollections(userId: string): Promise<CollectionOption[]> {
  // GROUP BY the primary key rather than SELECT DISTINCT: Postgres rejects
  // DISTINCT with an ORDER BY expression (lower(name)) that isn't selected.
  return db
    .select({ id: collection.id, name: collection.name })
    .from(collection)
    .innerJoin(bookCollection, eq(bookCollection.collectionId, collection.id))
    .where(eq(collection.userId, userId))
    .groupBy(collection.id)
    .orderBy(sql`lower(${collection.name})`);
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

/** Whether this user already has a search hit shelved, and where. For the preview page's CTA. */
export async function getBookByOlKey(
  userId: string,
  olKey: string
): Promise<{ id: string; shelf: Shelf } | null> {
  const [row] = await db
    .select({ id: book.id, shelf: book.shelf })
    .from(book)
    .where(and(eq(book.userId, userId), eq(book.olKey, olKey)));
  return row ? { id: row.id, shelf: row.shelf as Shelf } : null;
}

/*
 * The classifier takes one list of subject strings, and BISAC genres are the
 * better one when we have them: `subjects` is whatever the search endpoint
 * happened to return ("Butlers", "Country homes"), good enough to browse by but
 * not to classify with. A book still waiting for its backfill falls back to
 * them rather than dropping off the map.
 */
const classifyBy = <T extends { genres: string[] | null; subjects: string[] | null }>(
  row: T
) => ({ ...row, subjects: row.genres?.length ? row.genres : row.subjects });

/** Both shelves, only the fields the reading map shows (no notes/description reach the client). */
export async function getConstellationBooks(userId: string): Promise<MapBookInput[]> {
  const rows = await db
    .select({
      id: book.id,
      title: book.title,
      author: book.author,
      olKey: book.olKey,
      coverId: book.coverId,
      subjects: book.subjects,
      genres: book.genres,
      shelf: book.shelf,
      status: book.status,
      rating: book.rating,
      olRating: book.olRating,
      olRatingCount: book.olRatingCount,
    })
    .from(book)
    .where(eq(book.userId, userId));
  return rows.map(classifyBy);
}

/** Both shelves, only the fields the insights page needs. */
export async function getInsightsBooks(userId: string): Promise<InsightsBook[]> {
  const rows = await db
    .select({
      id: book.id,
      title: book.title,
      author: book.author,
      olKey: book.olKey,
      coverId: book.coverId,
      subjects: book.subjects,
      genres: book.genres,
      shelf: book.shelf,
      status: book.status,
      rating: book.rating,
      olRating: book.olRating,
      olRatingCount: book.olRatingCount,
      finishedAt: book.finishedAt,
      firstPublishYear: book.firstPublishYear,
    })
    .from(book)
    .where(eq(book.userId, userId));
  return rows.map(classifyBy);
}

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
  /** "YYYY-MM" (UTC), chosen here so the client never guesses its own "now". */
  currentMonth: string;
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
        eq(book.shelf, "library"),
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
    currentMonth: monthKey(new Date()),
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
