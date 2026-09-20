import { NextResponse } from "next/server";
import { searchBooksForUser } from "@/lib/booksearch";
import { getOptionalSession } from "@/lib/session";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 40;

/**
 * Search, proxied rather than called straight from the browser so the
 * response can be cached by Next, and so each hit can be annotated with
 * whether the signed-in user already has that book on a shelf.
 *
 * Serves both the header typeahead (small `limit`, or none) and the full
 * search results page (a larger one).
 */
export async function GET(request: Request) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const rawLimit = Number(params.get("limit"));
  const limit = Number.isInteger(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const results = await searchBooksForUser(session.user.id, q, limit);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Book search is unavailable right now." },
      { status: 502 }
    );
  }
}
