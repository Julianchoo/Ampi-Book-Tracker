import { z } from "zod";

/** Shelves a book can live on. A book is on exactly one. */
export const SHELVES = ["library", "wishlist"] as const;
export type Shelf = (typeof SHELVES)[number];

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
} as const;

export type SortKey = keyof typeof SORTS;

export function isSortKey(v: string | undefined): v is SortKey {
  return !!v && v in SORTS;
}

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

/** Cover URL for an Open Library cover id. Returns null so callers can fall back. */
export function coverUrl(
  coverId: number | null | undefined,
  size: "S" | "M" | "L" = "M"
): string | null {
  return coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
    : null;
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
