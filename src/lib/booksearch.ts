import type { BookSearchResult } from "@/lib/books";
import {
  getGoogleDescription,
  isGoogleBooksEnabled,
  searchGoogleBooks,
} from "@/lib/googlebooks";
import { getWorkDetail, searchBooks as searchOpenLibrary } from "@/lib/openlibrary";

/**
 * Picks a metadata provider.
 *
 * Google Books is preferred when a key is configured: it answers in about a
 * second where Open Library takes 2-20 and intermittently times out, and it
 * returns descriptions inline. Open Library is the fallback so the feature
 * keeps working with no key at all, and so a Google outage or a blown quota
 * degrades rather than breaks.
 */
export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  if (isGoogleBooksEnabled) {
    try {
      const results = await searchGoogleBooks(query);
      if (results.length > 0) return results;
      // An empty Google result is a real answer, not a failure — but Open
      // Library indexes older and non-English titles better, so it is worth
      // one look before telling the user there is nothing.
    } catch {
      // fall through to Open Library
    }
  }
  return searchOpenLibrary(query);
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
