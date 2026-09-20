import { z } from "zod";

/** Where a book's metadata came from. */
export const SOURCES = ["openlibrary", "google"] as const;
export type Source = (typeof SOURCES)[number];

/**
 * A search hit, normalised across providers so the UI never has to care which
 * service answered.
 */
export type BookSearchResult = {
  /** Provider-scoped id: "/works/OL893414W" or "google:zyTCAlFPjgYC". */
  olKey: string;
  source: Source;
  title: string;
  author: string | null;
  coverId: number | null;
  firstPublishYear: number | null;
  pages: number | null;
  language: string | null;
  subjects: string[];
  /** Present when the provider returns it inline, which saves a second call. */
  description: string | null;
};

/** Shelves a book can live on. A book is on exactly one. */
export const SHELVES = ["library", "wishlist"] as const;
export type Shelf = (typeof SHELVES)[number];

/** A search hit annotated with whether the signed-in user already shelved it. */
export type SearchHit = BookSearchResult & {
  onShelf: Shelf | null;
  bookId: string | null;
};

/** Reading status. Only meaningful for books on the library shelf. */
export const STATUSES = ["reading", "finished", "abandoned"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  reading: "Reading",
  finished: "Finished",
  abandoned: "Abandoned",
};

/** Rating scale: 1-10 stars in half-star steps. */
export const MAX_RATING = 10;
export const RATING_STEP = 0.5;

/**
 * Shelf sort options. These live here rather than beside the queries because
 * the toolbar is a client component — importing them from the query module
 * would pull the Postgres driver into the browser bundle.
 */
export const SORTS = {
  recent: "Recently active",
  title: "Title A–Z",
  author: "Author A–Z",
  rating: "Highest rated",
  finished: "Recently finished",
  added: "Recently added",
  year: "Publication year",
  community: "Community rating",
} as const;

export type SortKey = keyof typeof SORTS;

export function isSortKey(v: string | undefined): v is SortKey {
  return !!v && v in SORTS;
}

/** Which sorts make sense on which shelf — a wishlist book has no finish date or own rating. */
export const SHELF_SORTS: Record<Shelf, readonly SortKey[]> = {
  library: ["recent", "title", "author", "rating", "finished", "added", "year"],
  wishlist: ["added", "title", "author", "community", "year"],
};

export const DEFAULT_SORT: Record<Shelf, SortKey> = { library: "recent", wishlist: "added" };

export const VIEWS = ["grid", "wall"] as const;
export type View = (typeof VIEWS)[number];

/**
 * Below this many Open Library ratings an average is noise ("5.0 from 1"), so
 * it doesn't drive the community sort or the "best rated" highlight. Cards and
 * the book page still display it with its count.
 */
export const MIN_COMMUNITY_RATINGS = 5;

export const shelfSchema = z.enum(SHELVES);
export const statusSchema = z.enum(STATUSES);

/**
 * Ratings arrive from a client component, so the half-step grid is enforced
 * here rather than trusted. `real` in Postgres would happily store 7.31.
 */
export const ratingSchema = z
  .number()
  .min(RATING_STEP)
  .max(MAX_RATING)
  .refine((n) => Number.isInteger(n / RATING_STEP), {
    message: `Rating must be in steps of ${RATING_STEP}`,
  });

export type CoverSize = "S" | "M" | "L";

/*
 * Open Library serves a fixed three-rung ladder and tops out near 500px, so
 * there is nothing to negotiate — but its rungs are small, and S is a 39px
 * thumbnail. Ask one size above the display box so the cover still holds
 * together on a 2x screen.
 */
const OL_SIZE: Record<CoverSize, CoverSize> = { S: "M", M: "L", L: "L" };

/**
 * Cover candidates, sharpest first — try each until one loads.
 *
 * Derived from the provider key rather than stored. Google's cover CDN is
 * addressable by volume id and needs no API key, so a Google book's cover
 * needs no column of its own; Open Library's is built from its numeric cover
 * id. Empty means this book has no cover anywhere.
 */
export function coverUrls(
  olKey: string,
  coverId: number | null | undefined,
  size: CoverSize = "M"
): string[] {
  if (olKey.startsWith("google:")) {
    // One candidate, because the hard part is settled server-side: Google
    // hands out stand-in graphics with a 200 and only the byte count gives
    // them away, so /api/cover picks the sharpest zoom that is really there.
    const url = `/api/cover/${encodeURIComponent(olKey.slice("google:".length))}`;
    // S skips the high-zoom probe: 128px is plenty and never a stand-in.
    return [size === "S" ? `${url}?size=small` : url];
  }
  return coverId
    ? [`https://covers.openlibrary.org/b/id/${coverId}-${OL_SIZE[size]}.jpg`]
    : [];
}

/**
 * Does an image that loaded actually look like a book cover?
 *
 * Both providers answer 200 with something that isn't a cover when they have
 * nothing to give: Google serves a wide "image not available" strip (575x92,
 * 300x48, 800x128 measured) and Open Library a 43-byte blank. Real covers are
 * portrait — 1.5 is a deliberately loose bar, since a square-ish cover like
 * Open Library's 465x475 is unusual but real, and Google's strip is ~6:1.
 */
export function looksLikeCover(width: number, height: number): boolean {
  return width >= 16 && width <= height * 1.5;
}

/**
 * Index of the candidate to try after `failed` let us down.
 *
 * Keyed to the candidate that actually failed rather than being a blind
 * increment, because next/image can report load or error twice for the same
 * element — once from its ref when the bitmap is already cached, once from
 * the native event. A blind +1 skipped a rung on the second report and
 * dropped straight to the empty state, which hit precisely the books that
 * needed to step down at all.
 */
export function stepPastCandidate(
  candidates: string[],
  index: number,
  failed: string
): number {
  return candidates[index] === failed ? index + 1 : index;
}

/**
 * Outbound link to whichever service the book came from. Null for entries
 * added by hand, which have no page anywhere to link to.
 */
export function sourceUrl(
  olKey: string
): { href: string; label: string } | null {
  if (olKey.startsWith("manual:")) return null;
  if (olKey.startsWith("google:")) {
    return {
      href: `https://books.google.com/books?id=${olKey.slice("google:".length)}`,
      label: "Google Books",
    };
  }
  return {
    href: `https://openlibrary.org${olKey.startsWith("/") ? olKey : `/works/${olKey}`}`,
    label: "Open Library",
  };
}

/**
 * Route to a search hit's own preview page — the book's details without
 * adding it to a shelf. The hit's fields ride along as query params rather
 * than being re-fetched by key: the search already has them, a second
 * provider round-trip could disagree, and neither provider exposes a clean
 * "fetch one work by key with every field" call the way search does.
 *
 * olKey becomes the path so the page is a real, shareable/back-button-able
 * URL rather than a client-only modal. Open Library keys carry a leading
 * slash ("/works/OL27448W"); stripped and split on "/" it round-trips
 * through a catch-all segment with no encoding tricks. Google keys
 * ("google:xyz") have no slash and pass through as one segment.
 */
export function previewHref(hit: {
  olKey: string;
  source: Source;
  title: string;
  author: string | null;
  coverId: number | null;
  firstPublishYear: number | null;
  pages: number | null;
  language: string | null;
  subjects: string[];
}): string {
  const clean = hit.olKey.startsWith("/") ? hit.olKey.slice(1) : hit.olKey;
  const path = clean
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const params = new URLSearchParams({ source: hit.source, title: hit.title });
  if (hit.author) params.set("author", hit.author);
  if (hit.coverId != null) params.set("cover", String(hit.coverId));
  if (hit.firstPublishYear != null) params.set("year", String(hit.firstPublishYear));
  if (hit.pages != null) params.set("pages", String(hit.pages));
  if (hit.language) params.set("lang", hit.language);
  if (hit.subjects.length > 0) params.set("subjects", hit.subjects.join("|"));

  return `/books/preview/${path}?${params.toString()}`;
}

/** Inverse of the path half of previewHref(): catch-all segments back to an olKey. */
export function slugToOlKey(slug: string[]): string {
  const joined = slug.map((segment) => decodeURIComponent(segment)).join("/");
  return joined.startsWith("google:") ? joined : `/${joined}`;
}

/**
 * Amazon search URL built from title + author. Open Library rarely carries a
 * usable ASIN, and a search link never 404s the way a stale ASIN does.
 */
export function amazonUrl(title: string, author?: string | null): string {
  const q = [title, author].filter(Boolean).join(" ");
  return `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=stripbooks`;
}

/**
 * Open Library uses MARC 3-letter language codes, which are not the 2-letter
 * codes `Intl.DisplayNames` understands ("ger", not "de"). Map the ones that
 * actually show up and fall back to the bare code.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  eng: "English",
  ger: "German",
  fre: "French",
  spa: "Spanish",
  ita: "Italian",
  por: "Portuguese",
  dut: "Dutch",
  rus: "Russian",
  pol: "Polish",
  swe: "Swedish",
  nor: "Norwegian",
  dan: "Danish",
  fin: "Finnish",
  jpn: "Japanese",
  chi: "Chinese",
  kor: "Korean",
  ara: "Arabic",
  heb: "Hebrew",
  hin: "Hindi",
  tur: "Turkish",
  gre: "Greek",
  cze: "Czech",
  hun: "Hungarian",
  rum: "Romanian",
  ukr: "Ukrainian",
  vie: "Vietnamese",
  lat: "Latin",
};

export function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

/** "2024-03-08" -> "8 Mar 2024". Dates are stored as plain date strings, no TZ. */
export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
