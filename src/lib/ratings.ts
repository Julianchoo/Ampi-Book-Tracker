import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getOpenLibraryRating } from "@/lib/openlibrary";
import { book } from "@/lib/schema";

/**
 * Looks up and stores Open Library community ratings. Meant for after():
 * never awaited by a render. Sequential on purpose — Open Library allows
 * about 1 request/second and takes about that long to answer anyway.
 * Stops at the first failed request: if the service is down, the rest would
 * fail too, and each could burn the full 8s timeout.
 *
 * Must not touch request APIs (headers/cookies/session): after() callbacks
 * scheduled from a page can't. The caller passes the already-verified userId.
 */
export async function refreshRatings(
  userId: string,
  books: { id: string; title: string; author: string | null }[]
): Promise<void> {
  try {
    for (const b of books) {
      const r = await getOpenLibraryRating(b);
      // Failed request: leave olRatingCheckedAt alone so it's retried next visit.
      if (r === null) return;
      await db
        .update(book)
        .set({
          olRating: r.count > 0 ? r.average : null,
          olRatingCount: r.count,
          olRatingCheckedAt: new Date(),
        })
        .where(and(eq(book.id, b.id), eq(book.userId, userId)));
    }
  } catch (err) {
    // A background job has nobody to report to; throwing would only be an unhandled rejection.
    console.error("refreshRatings failed", err);
  }
}
