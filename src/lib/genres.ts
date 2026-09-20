import { after } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  getGoogleCategories,
  isGoogleBooksEnabled,
  matchesStoredTitle,
  searchGoogleBooks,
} from "@/lib/googlebooks";
import { ratingQuery } from "@/lib/openlibrary";
import { book } from "@/lib/schema";

type GenreTarget = {
  id: string;
  olKey: string;
  title: string;
  author: string | null;
};

const GOOGLE_PREFIX = "google:";

/** How many search matches to try after the stored edition comes back bare. */
const MAX_ALTERNATES = 2;

/**
 * Other Google volumes of the same book, best first.
 *
 * Deliberately has no try/catch. A throwing search (429 quota, 403, 5xx,
 * timeout) must travel up to refreshGenres' handler and abandon the run:
 * catching it here would make a failed request look like "no match" and write
 * an empty genre list that nothing ever re-reads.
 */
async function alternateVolumeIds(b: GenreTarget): Promise<string[]> {
  // ratingQuery lives with the Open Library fetch but its job is generic: it
  // strips the parenthetical edition noise ("(Pulitzer Prize Winner)") that
  // makes a free-text search match nothing. Google needs exactly that too.
  const hits = await searchGoogleBooks(ratingQuery(b.title, b.author), 3);
  return hits
    .filter((h) => matchesStoredTitle(b.title, h.title))
    .map((h) => h.olKey.slice(GOOGLE_PREFIX.length))
    .slice(0, MAX_ALTERNATES);
}

/**
 * Categories for one book, or null when a request failed.
 *
 * The edition the book was added from is asked first, but a Google volume
 * record is per-edition and plenty of them carry no categories at all — the
 * stored volumes for "Pop. 1280" and "Dispatches" are both bare while other
 * editions of the same books are fully classified. So a bare answer is worth a
 * search, and only the extra requests that buys something are spent.
 */
async function categoriesFor(b: GenreTarget): Promise<string[] | null> {
  const stored = b.olKey.startsWith(GOOGLE_PREFIX)
    ? b.olKey.slice(GOOGLE_PREFIX.length)
    : null;

  if (stored) {
    const categories = await getGoogleCategories(stored);
    if (categories === null || categories.length > 0) return categories;
  }

  for (const volumeId of await alternateVolumeIds(b)) {
    if (volumeId === stored) continue;
    const categories = await getGoogleCategories(volumeId);
    if (categories === null || categories.length > 0) return categories;
  }

  // Google answered for every edition we could find; none of them is classified.
  return [];
}

/**
 * Looks up and stores real BISAC genre paths from Google's per-volume
 * endpoint. Meant for after(): never awaited by a render. Sequential on
 * purpose — this is background work against a 1000/day quota, not something
 * worth spending burst capacity on.
 *
 * `genres` has no TTL and a non-null value is never looked at again, so the
 * only two outcomes are: write the categories Google gave us (`[]` included —
 * that is Google saying it has none), or write nothing at all and let the next
 * page view try again. A failed request must never reach the database.
 *
 * Must not touch request APIs (headers/cookies/session): after() callbacks
 * scheduled from a page can't. The caller passes the already-verified userId.
 */
export async function refreshGenres(
  userId: string,
  books: GenreTarget[]
): Promise<void> {
  if (!isGoogleBooksEnabled) return;
  try {
    for (const b of books) {
      const categories = await categoriesFor(b);
      // Couldn't ask: leave genres null so it's retried next visit. Like
      // refreshRatings, stop the whole run — the next book would fail too.
      if (categories === null) return;
      await db
        .update(book)
        .set({ genres: categories })
        .where(and(eq(book.id, b.id), eq(book.userId, userId)));
    }
  } catch (err) {
    // A background job has nobody to report to; throwing would only be an unhandled rejection.
    console.error("refreshGenres failed", err);
  }
}

/**
 * Schedules a genre lookup for a few of this user's never-looked-up books.
 *
 * Every caller must `await` this. It reaches after() only on the far side of a
 * database round trip, so a fire-and-forget call would resolve the select after
 * the work unit had closed and queue the callback where nothing runs it —
 * silently, with no error.
 */
export async function queueGenreBackfill(userId: string): Promise<void> {
  // No key, no point paying for the select.
  if (!isGoogleBooksEnabled) return;

  const rows = await db
    .select({
      id: book.id,
      olKey: book.olKey,
      title: book.title,
      author: book.author,
    })
    .from(book)
    .where(and(eq(book.userId, userId), isNull(book.genres)))
    // Mirrors pickStaleForRating's cap. A book costs one request when its own
    // edition is classified and at worst four when it is not, so ≤20 per page
    // view against a 1000/day quota.
    .limit(5);

  if (rows.length === 0) return;
  // ponytail: two tabs can pick the same 5 rows and do the work twice. It's
  // idempotent and bounded, so it only costs quota. Add a per-user in-flight
  // guard if that starts to matter.
  after(() => refreshGenres(userId, rows));
}
