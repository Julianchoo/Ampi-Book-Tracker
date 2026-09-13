import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { searchBooks } from "@/lib/booksearch";
import { db } from "@/lib/db";
import { book } from "@/lib/schema";
import { getOptionalSession } from "@/lib/session";

/**
 * Typeahead search. Proxied rather than called from the browser so the
 * response can be cached by Next, and so each hit can be annotated with
 * whether the signed-in user already has that book on a shelf.
 */
export async function GET(request: Request) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const results = await searchBooks(q);
    if (results.length === 0) return NextResponse.json({ results: [] });

    // Mark the ones already shelved so the UI can offer "view" instead of "add"
    const owned = await db
      .select({ olKey: book.olKey, shelf: book.shelf, id: book.id })
      .from(book)
      .where(
        and(
          eq(book.userId, session.user.id),
          inArray(
            book.olKey,
            results.map((r) => r.olKey)
          )
        )
      );

    const byKey = new Map(owned.map((o) => [o.olKey, o]));

    return NextResponse.json({
      results: results.map((r) => {
        const existing = byKey.get(r.olKey);
        return {
          ...r,
          onShelf: existing?.shelf ?? null,
          bookId: existing?.id ?? null,
        };
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Book search is unavailable right now." },
      { status: 502 }
    );
  }
}
