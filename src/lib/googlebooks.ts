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

export const isGoogleBooksEnabled = Boolean(process.env.GOOGLE_BOOKS_API_KEY);

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
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) throw new Error("GOOGLE_BOOKS_API_KEY is not set");

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

/** Long-form description for one volume, for rows saved before it was stored. */
export async function getGoogleDescription(
  volumeId: string
): Promise<string | null> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
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
