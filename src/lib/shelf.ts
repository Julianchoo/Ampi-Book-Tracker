import { DEFAULT_SORT, MIN_COMMUNITY_RATINGS, SHELF_SORTS, STATUSES, VIEWS } from "./books.ts";
import type { Shelf, SortKey, Status, View } from "./books.ts";

/*
 * Shelves are personal-sized, so pages load the whole shelf once and derive
 * filters, counts, sections and highlights here — pure, so it is testable
 * without a database.
 */

/** The fields shelf logic reads. The DB row (plus collectionIds) satisfies it. */
export type ShelfBook = {
  id: string;
  title: string;
  author: string | null;
  status: string | null;
  rating: number | null;
  pages: number | null;
  subjects: string[] | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: Date;
  olRating: number | null;
  olRatingCount: number | null;
  collectionIds: string[];
};

export type ShelfFilters = {
  status: Status | undefined;
  subject: string | undefined;
  author: string | undefined;
  collection: string | undefined;
  sort: SortKey;
  view: View;
};

type RawParams = Record<string, string | string[] | undefined>;

const MAX_TEXT_PARAM = 200;
const UUID_RE = /^[0-9a-f-]{36}$/i;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function textParam(v: string | string[] | undefined): string | undefined {
  const s = first(v)?.trim();
  return s && s.length <= MAX_TEXT_PARAM ? s : undefined;
}

function includes<T extends string>(list: readonly T[], v: string | undefined): v is T {
  return v !== undefined && (list as readonly string[]).includes(v);
}

/** URL params are user-editable, so anything invalid is dropped rather than trusted. */
export function parseShelfParams(params: RawParams, shelf: Shelf): ShelfFilters {
  const status = first(params.status);
  const collection = first(params.collection);
  const sort = first(params.sort);
  const view = first(params.view);
  return {
    // Wishlist books have no reading status, so the param means nothing there.
    status: shelf === "library" && includes(STATUSES, status) ? status : undefined,
    subject: textParam(params.subject),
    author: textParam(params.author),
    collection: collection && UUID_RE.test(collection) ? collection : undefined,
    sort: includes(SHELF_SORTS[shelf], sort) ? sort : DEFAULT_SORT[shelf],
    view: includes(VIEWS, view) ? view : "grid",
  };
}

/** Sort and view only reorder or restyle; they never hide a book. */
export function hasActiveFilters(f: ShelfFilters): boolean {
  return !!(f.status || f.subject || f.author || f.collection);
}

/** Drops every filter but keeps how the shelf is ordered and displayed. */
export function clearFiltersHref(shelf: Shelf, filters: ShelfFilters): string {
  const params = new URLSearchParams();
  if (filters.sort !== DEFAULT_SORT[shelf]) params.set("sort", filters.sort);
  if (filters.view === "wall") params.set("view", "wall");
  const qs = params.toString();
  return qs ? `/${shelf}?${qs}` : `/${shelf}`;
}

export function filterBooks<T extends ShelfBook>(
  books: T[],
  f: ShelfFilters,
  opts: { ignoreStatus?: boolean } = {}
): T[] {
  const subject = f.subject?.toLowerCase();
  const author = f.author?.trim().toLowerCase();
  return books.filter(
    (b) =>
      (opts.ignoreStatus || !f.status || b.status === f.status) &&
      (!subject || (b.subjects ?? []).some((s) => s.toLowerCase() === subject)) &&
      (!author || b.author?.trim().toLowerCase() === author) &&
      (!f.collection || b.collectionIds.includes(f.collection))
  );
}

export type StatusCounts = { all: number; reading: number; finished: number; abandoned: number };

export function statusCounts(books: ShelfBook[]): StatusCounts {
  const counts: StatusCounts = { all: books.length, reading: 0, finished: 0, abandoned: 0 };
  for (const b of books) {
    if (includes(STATUSES, b.status ?? undefined)) counts[b.status as Status]++;
  }
  return counts;
}

/** Open Library catalogue tags that describe the scan, not the book. */
const SUBJECT_STOPLIST = new Set([
  "accessible book",
  "protected daisy",
  "in library",
  "lending library",
  "large type books",
]);

/** `key` is a trimmed, lowercased subject. */
export function isNoiseSubject(key: string): boolean {
  return SUBJECT_STOPLIST.has(key) || key.startsWith("overdrive") || key.includes("nyt:");
}

export function topSubjects(books: ShelfBook[], max = 12): string[] {
  // key -> total count, plus per-casing counts to pick the label people actually see most.
  const groups = new Map<string, { count: number; casings: Map<string, number> }>();
  for (const b of books) {
    for (const raw of b.subjects ?? []) {
      const label = raw.trim();
      const key = label.toLowerCase();
      if (!key || isNoiseSubject(key)) continue;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { count: 0, casings: new Map() }));
      g.count++;
      g.casings.set(label, (g.casings.get(label) ?? 0) + 1);
    }
  }
  const ranked = [...groups.values()].map((g) => {
    let label = "";
    let best = 0;
    // Map iterates in insertion order, so strict > keeps the first-seen casing on ties.
    for (const [casing, n] of g.casings) {
      if (n > best) [label, best] = [casing, n];
    }
    return { label, count: g.count };
  });
  ranked.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return ranked.slice(0, max).map((r) => r.label);
}

const DAY_MS = 86_400_000;

function parseDay(value: string | null): number | null {
  const m = value && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Inclusive: starting and finishing on the same day is a one-day read. */
export function readingDays(startedAt: string | null, finishedAt: string | null): number | null {
  const start = parseDay(startedAt);
  const end = parseDay(finishedAt);
  if (start === null || end === null || end < start) return null;
  return Math.round((end - start) / DAY_MS) + 1;
}

export function formatDays(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? word : `${word}s`}`;
}

export type ShelfSection<T> = { key: string; title: string | null; summary: string | null; books: T[] };

/** Year sections only tell a story in the default chronological view with finished books in it. */
export function shouldGroup(shelf: Shelf, f: ShelfFilters): boolean {
  return shelf === "library" && f.sort === "recent" && f.status !== "reading" && f.status !== "abandoned";
}

function yearSummary(books: ShelfBook[]): string {
  const parts = [plural(books.length, "book")];
  const pages = books.reduce((sum, b) => sum + (b.pages ?? 0), 0);
  if (pages > 0) parts.push(`${pages.toLocaleString("en-GB")} pages`);
  const ratings = books.flatMap((b) => (b.rating == null ? [] : [b.rating]));
  if (ratings.length > 0) {
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    parts.push(`avg ${avg.toFixed(1)}`);
  }
  return parts.join(" · ");
}

export function groupByYear<T extends ShelfBook>(books: T[]): ShelfSection<T>[] {
  const reading: T[] = [];
  const abandoned: T[] = [];
  const noDate: T[] = [];
  const years = new Map<string, T[]>();
  for (const b of books) {
    // An abandoned book may still carry a finish date; it isn't a book read that year.
    if (b.status === "reading") reading.push(b);
    else if (b.status === "abandoned") abandoned.push(b);
    else if (b.finishedAt) {
      const year = b.finishedAt.slice(0, 4);
      const list = years.get(year);
      if (list) list.push(b);
      else years.set(year, [b]);
    } else noDate.push(b);
  }

  const simple = (key: string, title: string, list: T[]): ShelfSection<T> => ({
    key,
    title,
    summary: plural(list.length, "book"),
    books: list,
  });

  const sections: ShelfSection<T>[] = [];
  if (reading.length) sections.push(simple("reading", "Reading", reading));
  for (const year of [...years.keys()].sort().reverse()) {
    const list = years.get(year)!;
    sections.push({ key: `year-${year}`, title: year, summary: yearSummary(list), books: list });
  }
  if (noDate.length) sections.push(simple("no-date", "No date", noDate));
  if (abandoned.length) sections.push(simple("abandoned", "Abandoned", abandoned));
  return sections;
}

export type Highlight<T> = { label: string; value: string; book: T };
export type Highlights<T> = { title: string; items: Highlight<T>[] };

/**
 * The book with the best score, first in input order on ties. Books already
 * featured and books with no score (null) are skipped, so one book never fills
 * two highlight slots.
 */
function pick<T extends ShelfBook>(
  books: T[],
  used: Set<string>,
  score: (b: T) => number | null,
  better: (a: number, b: number) => boolean
): { book: T; score: number } | null {
  let best: { book: T; score: number } | null = null;
  for (const b of books) {
    if (used.has(b.id)) continue;
    const s = score(b);
    if (s === null) continue;
    if (!best || better(s, best.score)) best = { book: b, score: s };
  }
  if (best) used.add(best.book.id);
  return best;
}

const higher = (a: number, b: number) => a > b;
const lower = (a: number, b: number) => a < b;
const positivePages = (b: ShelfBook) => (b.pages != null && b.pages > 0 ? b.pages : null);

export function libraryHighlights<T extends ShelfBook>(books: T[], year: number): Highlights<T> | null {
  const finished = books.filter((b) => b.status === "finished");
  let candidates = finished.filter((b) => b.finishedAt?.startsWith(`${year}-`));
  let title = `${year} highlights`;
  // Early in a year there may be nothing finished yet; all-time beats an empty strip.
  if (candidates.length === 0) {
    candidates = finished;
    title = "All-time highlights";
  }
  if (candidates.length === 0) return null;

  const used = new Set<string>();
  const items: Highlight<T>[] = [];
  const top = pick(candidates, used, (b) => b.rating, higher);
  if (top) items.push({ label: "Top rated", value: `${top.score}/10`, book: top.book });
  const longest = pick(candidates, used, positivePages, higher);
  if (longest) {
    items.push({ label: "Longest", value: `${longest.score.toLocaleString("en-GB")} pages`, book: longest.book });
  }
  const quickest = pick(candidates, used, (b) => readingDays(b.startedAt, b.finishedAt), lower);
  if (quickest) {
    items.push({ label: "Quickest read", value: `Read in ${formatDays(quickest.score)}`, book: quickest.book });
  }
  return items.length ? { title, items } : null;
}

export function hasCommunityRating(b: { olRating: number | null; olRatingCount: number | null }): boolean {
  return b.olRating != null && (b.olRatingCount ?? 0) >= MIN_COMMUNITY_RATINGS;
}

export function wishlistHighlights<T extends ShelfBook>(books: T[]): Highlights<T> | null {
  if (books.length === 0) return null;
  const used = new Set<string>();
  const items: Highlight<T>[] = [];
  const shortest = pick(books, used, positivePages, lower);
  if (shortest) {
    items.push({ label: "Shortest", value: `${shortest.score.toLocaleString("en-GB")} pages`, book: shortest.book });
  }
  const waiting = pick(books, used, (b) => b.createdAt.getTime(), lower);
  if (waiting) {
    const monthYear = waiting.book.createdAt.toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    items.push({ label: "Waiting longest", value: `Added ${monthYear}`, book: waiting.book });
  }
  const best = pick(books, used, (b) => (hasCommunityRating(b) ? b.olRating : null), higher);
  if (best) {
    items.push({ label: "Best rated on Open Library", value: `${best.score.toFixed(1)}/5`, book: best.book });
  }
  return items.length ? { title: "Highlights", items } : null;
}

/** How long a fetched community rating is trusted before it is refreshed. */
export const RATING_TTL_DAYS = 30;

/**
 * Books whose community rating should be (re)fetched this view. Never-checked
 * books go first; the cap keeps a slow, rate-limited API from stalling a page.
 */
export function pickStaleForRating<T extends { olRatingCheckedAt: Date | null }>(
  books: T[],
  now = new Date(),
  max = 5
): T[] {
  const cutoff = now.getTime() - RATING_TTL_DAYS * DAY_MS;
  const never = books.filter((b) => b.olRatingCheckedAt === null);
  const stale = books
    .filter((b) => b.olRatingCheckedAt !== null && b.olRatingCheckedAt.getTime() < cutoff)
    .sort((a, b) => a.olRatingCheckedAt!.getTime() - b.olRatingCheckedAt!.getTime());
  return [...never, ...stale].slice(0, max);
}
