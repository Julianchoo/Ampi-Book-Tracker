import { inArray, and, eq } from "drizzle-orm";
import type { BookSearchResult, SearchHit, Shelf } from "@/lib/books";
import { db } from "@/lib/db";
import {
  getGoogleDescription,
  isGoogleBooksEnabled,
  searchGoogleBooks,
} from "@/lib/googlebooks";
import { getWorkDetail, searchBooks as searchOpenLibrary } from "@/lib/openlibrary";
import { book } from "@/lib/schema";

/**
 * Picks a metadata provider.
 *
 * Google Books is preferred when a key is configured: it answers in about a
 * second where Open Library takes 2-20 and intermittently times out, and it
 * returns descriptions inline. Open Library is the fallback so the feature
 * keeps working with no key at all, and so a Google outage or a blown quota
 * degrades rather than breaks.
 */
export async function searchBooks(
  query: string,
  limit = 8
): Promise<BookSearchResult[]> {
  if (isGoogleBooksEnabled) {
    try {
      const results = await searchGoogleBooks(query, limit);
      if (results.length > 0) return results;
      // An empty Google result is a real answer, not a failure — but Open
      // Library indexes older and non-English titles better, so it is worth
      // one look before telling the user there is nothing.
    } catch {
      // fall through to Open Library
    }
  }
  return searchOpenLibrary(query, limit);
}

/**
 * Search, then mark each hit with whether this user already has it on a
 * shelf. Shared by the typeahead route and the full search page so the
 * "mark owned" query lives in one place.
 */
export async function searchBooksForUser(
  userId: string,
  query: string,
  limit = 8
): Promise<SearchHit[]> {
  const results = await searchBooks(query, limit);
  if (results.length === 0) return [];

  const owned = await db
    .select({ olKey: book.olKey, shelf: book.shelf, id: book.id })
    .from(book)
    .where(
      and(
        eq(book.userId, userId),
        inArray(
          book.olKey,
          results.map((r) => r.olKey)
        )
      )
    );

  const byKey = new Map(owned.map((o) => [o.olKey, o]));

  return results.map((r) => {
    const existing = byKey.get(r.olKey);
    return {
      ...r,
      onShelf: (existing?.shelf as Shelf | undefined) ?? null,
      bookId: existing?.id ?? null,
    };
  });
}

/**
 * Blurb for a book already on a shelf, for rows saved before descriptions were
 * stored. New rows carry it in the database and never reach this.
 */
export async function getDescription(olKey: string): Promise<string | null> {
  if (olKey.startsWith("google:")) {
    return getGoogleDescription(olKey.slice("google:".length));
  }
  const { description } = await getWorkDetail(olKey);
  return description;
}
