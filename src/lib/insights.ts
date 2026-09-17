import { MAX_RATING, RATING_STEP } from "./books.ts";
import { buildGenreGraph, type MapBookInput } from "./constellation.ts";

/*
 * The /insights page: three views of one shelf — which eras you read, how your
 * genres compare, how you rate. Pure, so the rules are testable without a
 * database, and so the page can stay a thin server component.
 *
 * Genres are not modelled again here: buildGenreGraph already turns the messy
 * subject strings into a small genre graph, and this file only counts against
 * it.
 */

/** A book as the insights page sees it: the genre input plus the dated fields. */
export type InsightsBook = MapBookInput & {
  finishedAt: string | null; // "YYYY-MM-DD"
  firstPublishYear: number | null;
};

export type DecadeBar = {
  decade: number; // 1990, 2000 …
  label: string; // "1990s"
  books: number; // books published in that decade (read side)
  rated: number; // how many of them you rated
  avgRating: number | null;
};

export type GenreBubble = {
  id: string;
  label: string;
  read: number; // finished library books in this genre (in range)
  pending: number; // wishlist books in this genre (always all-time)
  rated: number;
  avgRating: number; // bubbles only exist when this is known
  /** Up to 3 of the genre's best-rated read books, for the panel/tooltip. */
  topBooks: { id: string; title: string; rating: number | null }[];
};

/** Genres with nothing read yet — the "Not started yet" strip. */
export type PendingGenre = { id: string; label: string; pending: number };

export type RatingBar = { rating: number; books: number };

export type Insights = {
  /** Which slice the read-side numbers cover. */
  range: "all" | "year";
  year: number;
  decades: DecadeBar[];
  /** Caption naming the best/worst-rated decade with enough books. */
  decadesNote: string | null;
  bubbles: GenreBubble[];
  pendingGenres: PendingGenre[];
  /** Fitted x-domain for the bubble chart, e.g. [5.2, 8.1]. */
  ratingDomain: [number, number];
  /** Mean rating across the read books in range, for the reference line. */
  avgRating: number | null;
  ratings: RatingBar[];
  ratingsNote: string | null;
  /** Books linked to each bubble, for the detail panel. */
  booksByGenre: Record<
    string,
    { id: string; title: string; author: string | null; rating: number | null; pending: boolean }[]
  >;
  counts: { read: number; pending: number; rated: number };
};

/** The catch-all genre from buildGenreGraph — a bag, not a taste, so never a bubble. */
const OTHER_ID = "other";
/** One or two books is an anecdote; a bubble claims a genre average. */
const MIN_BUBBLE_BOOKS = 2;
/** Same idea for the decade caption: never rank a decade on one or two ratings. */
const MIN_NOTE_RATINGS = 3;
/** Below this the rating distribution has no shape worth describing. */
const MIN_RATINGS_NOTE = 5;
/** Breathing room either side of the fitted bubble range. */
const DOMAIN_PAD = 0.3;
/** A domain narrower than this turns rating noise into dramatic distance. */
const MIN_DOMAIN_WIDTH = 1;
/** Half-width of the "most of your ratings live here" window in the ratings note. */
const NOTE_WINDOW = 1;

/** Code-unit comparison: stable across locales, unlike localeCompare. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Rounds away float dust (7.8 + 0.3 = 8.100000000000001) before stepping to a tenth. */
function tenth(n: number, step: (x: number) => number): number {
  return step(Number((n * 10).toFixed(6))) / 10;
}

const round1 = (n: number) => tenth(n, Math.round);

function mean(values: number[]): number {
  return round1(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Drops a trailing ".0" so a note reads "between 6 and 8", not "between 6.0 and 8.0". */
function num(n: number): string {
  const rounded = round1(n);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function parentOf(id: string): string | null {
  const slash = id.indexOf("/");
  return slash === -1 ? null : id.slice(0, slash);
}

const ratingsOf = (books: InsightsBook[]) => books.flatMap((b) => (b.rating == null ? [] : [b.rating]));

/** Best rated first, unrated last, then by title — the order the panel and topBooks share. */
function byRating(a: InsightsBook, b: InsightsBook): number {
  return (b.rating ?? -1) - (a.rating ?? -1) || cmp(a.title, b.title);
}

type GenreBooks = { read: InsightsBook[]; pending: InsightsBook[] };

/**
 * Genre → its read (in range) and pending books. A book counts toward its own
 * genre and that genre's parent, exactly as the reading map counts it, so
 * "Fiction" and "Fiction / Thrillers" are both real bubbles.
 */
function groupByGenre(
  all: InsightsBook[],
  read: InsightsBook[],
  pending: InsightsBook[]
): { labels: Map<string, string>; groups: Map<string, GenreBooks> } {
  const labels = new Map<string, string>();
  const groups = new Map<string, GenreBooks>();
  const graph = buildGenreGraph(all);
  if (!graph) return { labels, groups };

  for (const g of graph.genres) {
    if (g.id !== OTHER_ID) labels.set(g.id, g.label);
  }

  const genresByBook = new Map<string, string[]>();
  for (const node of graph.books) {
    const ids = new Set<string>();
    for (const id of node.genreIds) {
      if (id === OTHER_ID) continue;
      ids.add(id);
      const parent = parentOf(id);
      if (parent) ids.add(parent);
    }
    genresByBook.set(node.id, [...ids]);
  }

  const add = (books: InsightsBook[], key: keyof GenreBooks) => {
    for (const b of books) {
      for (const id of genresByBook.get(b.id) ?? []) {
        let group = groups.get(id);
        if (!group) groups.set(id, (group = { read: [], pending: [] }));
        group[key].push(b);
      }
    }
  };
  add(read, "read");
  add(pending, "pending");
  return { labels, groups };
}

/** Bars from the earliest decade read to the latest; a decade with nothing keeps its empty slot. */
function buildDecades(read: InsightsBook[]): DecadeBar[] {
  // ponytail: gaps are filled between min and max, so one wildly old publication
  // year would mean a very long axis. Clamp the span if that ever shows up.
  const buckets = new Map<number, { books: number; ratings: number[] }>();
  for (const b of read) {
    const year = b.firstPublishYear;
    if (year == null || year <= 0) continue;
    const decade = Math.floor(year / 10) * 10;
    let bucket = buckets.get(decade);
    if (!bucket) buckets.set(decade, (bucket = { books: 0, ratings: [] }));
    bucket.books++;
    if (b.rating != null) bucket.ratings.push(b.rating);
  }
  if (buckets.size === 0) return [];

  const decades: DecadeBar[] = [];
  const present = [...buckets.keys()];
  const last = Math.max(...present);
  for (let decade = Math.min(...present); decade <= last; decade += 10) {
    const bucket = buckets.get(decade);
    decades.push({
      decade,
      label: `${decade}s`,
      books: bucket?.books ?? 0,
      rated: bucket?.ratings.length ?? 0,
      avgRating: bucket && bucket.ratings.length > 0 ? mean(bucket.ratings) : null,
    });
  }
  return decades;
}

function decadesNoteFor(decades: DecadeBar[]): string | null {
  const rankable = decades
    .filter((d) => d.rated >= MIN_NOTE_RATINGS && d.avgRating != null)
    .sort((a, b) => b.avgRating! - a.avgRating! || a.decade - b.decade);
  const best = rankable[0];
  const worst = rankable[rankable.length - 1];
  // Two decades scoring the same is a real result, but not a sentence worth writing.
  if (!best || !worst || best === worst || best.avgRating === worst.avgRating) return null;
  return `Your ${best.label} books score best (${best.avgRating!.toFixed(1)}); the ${worst.label} trail at ${worst.avgRating!.toFixed(1)}.`;
}

/** Half-star buckets from the lowest rating given to the highest — no empty tails. */
function buildRatings(ratings: number[]): RatingBar[] {
  if (ratings.length === 0) return [];
  const low = Math.min(...ratings);
  const steps = Math.round((Math.max(...ratings) - low) / RATING_STEP);
  const counts = new Map<number, number>();
  for (const r of ratings) counts.set(r, (counts.get(r) ?? 0) + 1);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const rating = round1(low + i * RATING_STEP);
    return { rating, books: counts.get(rating) ?? 0 };
  });
}

function ratingsNoteFor(bars: RatingBar[], ratings: number[], avg: number | null): string | null {
  if (ratings.length < MIN_RATINGS_NOTE || avg == null) return null;
  const common = [...bars].sort((a, b) => b.books - a.books || a.rating - b.rating)[0];
  if (!common) return null;
  const [low, high] = [avg - NOTE_WINDOW, avg + NOTE_WINDOW];
  const inside = ratings.filter((r) => r >= low && r <= high).length;
  const share = Math.round((100 * inside) / ratings.length);
  return `You give ${num(common.rating)} most often — ${share}% of your ratings land between ${num(low)} and ${num(high)}.`;
}

/**
 * An axis fitted to the ratings actually given: on a 0–10 axis a real shelf
 * (every genre between 5.6 and 7.8) is one indistinguishable clump.
 */
function fitDomain(avgs: number[], fallback: number | null): [number, number] {
  let low: number;
  let high: number;
  if (avgs.length >= 2) {
    low = tenth(Math.min(...avgs) - DOMAIN_PAD, Math.floor);
    high = tenth(Math.max(...avgs) + DOMAIN_PAD, Math.ceil);
  } else {
    const centre = avgs[0] ?? fallback ?? MAX_RATING / 2;
    low = round1(centre - 1);
    high = round1(centre + 1);
  }
  low = Math.max(0, low);
  high = Math.min(MAX_RATING, high);
  if (high - low < MIN_DOMAIN_WIDTH) {
    const centre = (low + high) / 2;
    low = round1(Math.min(Math.max(0, centre - MIN_DOMAIN_WIDTH / 2), MAX_RATING - MIN_DOMAIN_WIDTH));
    high = round1(low + MIN_DOMAIN_WIDTH);
  }
  return [low, high];
}

export function buildInsights(
  books: InsightsBook[],
  opts: { range: "all" | "year"; year: number }
): Insights {
  const { range, year } = opts;
  // The year toggle is about when you read a book, so it only ever moves the
  // read side; a wishlist book has no date to filter on.
  const inRange = (b: InsightsBook) => range === "all" || (b.finishedAt?.startsWith(`${year}-`) ?? false);
  const read = books.filter((b) => b.shelf === "library" && b.status === "finished" && inRange(b));
  const pending = books.filter((b) => b.shelf === "wishlist");

  const { labels, groups } = groupByGenre(books, read, pending);
  const bubbles: GenreBubble[] = [];
  const pendingGenres: PendingGenre[] = [];
  const booksByGenre: Insights["booksByGenre"] = {};

  for (const [id, group] of groups) {
    const label = labels.get(id) ?? id;
    const ratings = ratingsOf(group.read);
    if (group.read.length >= MIN_BUBBLE_BOOKS && ratings.length > 0) {
      const readSorted = [...group.read].sort(byRating);
      bubbles.push({
        id,
        label,
        read: group.read.length,
        pending: group.pending.length,
        rated: ratings.length,
        avgRating: mean(ratings),
        topBooks: readSorted.slice(0, 3).map((b) => ({ id: b.id, title: b.title, rating: b.rating })),
      });
      booksByGenre[id] = [
        ...readSorted.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          rating: b.rating,
          pending: false,
        })),
        ...[...group.pending]
          .sort((a, b) => cmp(a.title, b.title))
          .map((b) => ({ id: b.id, title: b.title, author: b.author, rating: null, pending: true })),
      ];
    } else if (group.read.length === 0 && group.pending.length > 0) {
      pendingGenres.push({ id, label, pending: group.pending.length });
    }
  }

  bubbles.sort((a, b) => b.read - a.read || cmp(a.label, b.label));
  pendingGenres.sort((a, b) => b.pending - a.pending || cmp(a.label, b.label));

  const decades = buildDecades(read);
  const ratings = ratingsOf(read);
  const avgRating = ratings.length > 0 ? mean(ratings) : null;
  const ratingBars = buildRatings(ratings);

  return {
    range,
    year,
    decades,
    decadesNote: decadesNoteFor(decades),
    bubbles,
    pendingGenres,
    ratingDomain: fitDomain(
      bubbles.map((b) => b.avgRating),
      avgRating
    ),
    avgRating,
    ratings: ratingBars,
    ratingsNote: ratingsNoteFor(ratingBars, ratings, avgRating),
    booksByGenre,
    counts: { read: read.length, pending: pending.length, rated: ratings.length },
  };
}
