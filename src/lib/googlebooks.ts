import type { BookSearchResult } from "@/lib/books";

/**
 * Google Books client.
 *
 * Faster and steadier than Open Library, and — the reason it is worth a second
 * provider — it returns the description inline with the search results, so a
 * book added from Google needs no follow-up request to show its blurb.
 *
 * An API key is required. The keyless endpoint shares one anonymous quota
 * across every caller on the internet and answers 429 essentially always.
 */

const ENDPOINT = "https://www.googleapis.com/books/v1/volumes";
const TIMEOUT_MS = 8000;

export const isGoogleBooksEnabled = Boolean(process.env.BOOKS_API_KEY);

type Volume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    pageCount?: number;
    language?: string;
    categories?: string[];
    description?: string;
  };
};

/** "2020-09-15" | "2020" -> 2020 */
function toYear(published: string | undefined): number | null {
  const year = Number(published?.slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : null;
}

function toResult(v: Volume): BookSearchResult | null {
  const info = v.volumeInfo;
  if (!v.id || !info?.title) return null;

  return {
    olKey: `google:${v.id}`,
    source: "google",
    title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
    author: info.authors?.[0] ?? null,
    coverId: null,
    firstPublishYear: toYear(info.publishedDate),
    pages: info.pageCount && info.pageCount > 0 ? info.pageCount : null,
    language: info.language ?? null,
    subjects: (info.categories ?? []).slice(0, 6),
    description: info.description?.trim() || null,
  };
}

export async function searchGoogleBooks(
  query: string,
  limit = 8
): Promise<BookSearchResult[]> {
  const key = process.env.BOOKS_API_KEY;
  if (!key) throw new Error("BOOKS_API_KEY is not set");

  const url =
    `${ENDPOINT}?q=${encodeURIComponent(query)}` +
    `&maxResults=${limit}&printType=books&orderBy=relevance` +
    `&key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Google Books search failed: ${res.status}`);
  }

  const data = (await res.json()) as { items?: Volume[] };
  return (data.items ?? [])
    .map(toResult)
    .filter((b): b is BookSearchResult => b !== null);
}

/**
 * Google's per-volume endpoint returns the union of every BISAC path its
 * editions carry — up to ~19 for a popular book, with unrelated families at
 * the tail. *The Silent Patient* comes back with nine "Fiction / …" paths
 * followed by "Religion / Ancient", "Psychology / Assessment, Testing &
 * Measurement", "Art / History / Ancient & Classical" and "Medical / Ethics".
 *
 * The leading segment is the family, so keeping only the most common one drops
 * the tail without a hand-written blocklist. Ties go to whichever family was
 * seen first, which is the order Google itself considers most relevant.
 */
export function pickBisacCategories(categories: string[], max = 6): string[] {
  const entries: { text: string; family: string }[] = [];
  const counts = new Map<string, number>();

  for (const raw of categories) {
    const text = raw.trim();
    if (!text) continue;
    const family = (text.split("/")[0] ?? "").trim().toLowerCase();
    entries.push({ text, family });
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }

  let winner: string | null = null;
  for (const { family } of entries) {
    if (winner === null || counts.get(family)! > counts.get(winner)!) {
      winner = family;
    }
  }

  return entries
    .filter((e) => e.family === winner)
    .slice(0, max)
    .map((e) => e.text);
}

/** lowercase, unaccented, subtitle dropped, punctuation and spacing flattened */
function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(":")[0]!
    // Apostrophes close up ("handmaid's" -> "handmaids") so a candidate that
    // drops them still matches; every other mark becomes a space, so an em
    // dash and a hyphen agree rather than fusing the words either side.
    .replace(/['‘’]/g, "")
    .replace(/\p{P}|\p{S}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether a Google volume title is the same book as the one we stored.
 *
 * Searching by title alone happily returns a translation ("Crónicas de Dune"),
 * a foreign edition ("Sapiens. De animales a dioses") or a study guide
 * ("Summary of The Silent Patient"), and resolving a stored book to one of
 * those writes the wrong metadata onto it. Exact equality after normalising is
 * deliberately strict: a miss costs nothing, a false match corrupts a row.
 *
 * Everything from the first ":" is dropped because `toResult` above merges the
 * subtitle in as `${title}: ${subtitle}`, so "Dune" and "Dune: The Graphic
 * Novel" are the same volume seen with and without one.
 */
export function matchesStoredTitle(stored: string, candidate: string): boolean {
  const a = normaliseTitle(stored);
  const b = normaliseTitle(candidate);
  return a.length > 0 && a === b;
}

/** Long-form description for one volume, for rows saved before it was stored. */
export async function getGoogleDescription(
  volumeId: string
): Promise<string | null> {
  const key = process.env.BOOKS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${ENDPOINT}/${encodeURIComponent(volumeId)}?key=${encodeURIComponent(key)}`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Volume;
    return data.volumeInfo?.description?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * BISAC categories for one volume, trimmed to the dominant family.
 *
 * Null means "couldn't ask" (no API key, non-2xx, timeout, thrown) so the
 * caller retries later; `[]` means Google answered and this volume genuinely
 * has no categories. Collapsing the two would persist an empty list on a
 * transient failure and leave the book permanently uncategorised.
 */
export async function getGoogleCategories(
  volumeId: string
): Promise<string[] | null> {
  const key = process.env.BOOKS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${ENDPOINT}/${encodeURIComponent(volumeId)}?key=${encodeURIComponent(key)}`,
      {
        // The caller persists the result, and this runs inside after() where
        // the data cache buys nothing and would add an ISR entry per book.
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Volume;
    return pickBisacCategories(data.volumeInfo?.categories ?? []);
  } catch {
    return null;
  }
}
