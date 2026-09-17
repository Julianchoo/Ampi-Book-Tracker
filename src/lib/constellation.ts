import { coverUrls } from "./books.ts";
import { isNoiseSubject } from "./shelf.ts";

/*
 * The home page "reading map": books linked to a small genre graph built from
 * messy subject strings (Google BISAC paths like "Fiction / Thrillers /
 * Psychological" mixed with flat Open Library tags like "Thriller"). Pure, so
 * the rules are testable; the force layout lives in constellation-layout.ts.
 */

/** Input: the fields the map needs, nothing private (no notes/description). */
export type MapBookInput = {
  id: string;
  title: string;
  author: string | null;
  olKey: string;
  coverId: number | null;
  subjects: string[] | null;
  shelf: string; // "library" | "wishlist"
  status: string | null;
  rating: number | null; // own rating 0.5–10
  olRating: number | null; // Open Library 1–5
  olRatingCount: number | null;
};

export type GenreNode = {
  kind: "genre";
  id: string; // "fiction", "fiction/thrillers", "other"
  label: string; // display label, e.g. "Thrillers"
  depth: 0 | 1;
  parentId: string | null; // depth-1 → its depth-0 id
  bookCount: number; // distinct books linked to it or its children
  x: number;
  y: number;
  r: number; // filled by layout (0 before)
};

export type BookNode = {
  kind: "book";
  id: string;
  title: string;
  author: string | null;
  shelf: "library" | "wishlist";
  status: string | null;
  rating: number | null;
  olRating: number | null;
  olRatingCount: number | null;
  cover: string[]; // coverUrls(olKey, coverId, "M")
  thumb: string[]; // coverUrls(olKey, coverId, "S") — the map's small cover
  genreIds: string[]; // 1–2 genre ids this book links to
  x: number;
  y: number;
  r: number;
};

export type MapLink = { source: string; target: string; kind: "parent" | "book" };

export type ReadingMap = {
  width: number; // viewBox width (1000)
  height: number; // viewBox height (720)
  genres: GenreNode[];
  books: BookNode[];
  links: MapLink[];
  /** Ids of the up-to-6 genres with the most books (labels in the preview). */
  topGenreIds: string[];
};

const OTHER_ID = "other";
const MIN_GENRE_BOOKS = 2;
const MAX_LINKS_PER_BOOK = 2;
const MAX_TOP_GENRES = 6;
const MIN_MAPPED_BOOKS = 3;

/** Flat subjects that mean the same thing as a BISAC path. Keys are lowercased whole subjects. */
const SYNONYMS: Record<string, string[]> = {
  "literary fiction": ["Fiction", "Literary"],
  literary: ["Fiction", "Literary"],
  thriller: ["Fiction", "Thrillers"],
  thrillers: ["Fiction", "Thrillers"],
  suspense: ["Fiction", "Thrillers"],
  horror: ["Fiction", "Horror"],
  "science fiction": ["Fiction", "Science Fiction"],
  "sci-fi": ["Fiction", "Science Fiction"],
  fantasy: ["Fiction", "Fantasy"],
  "historical fiction": ["Fiction", "Historical"],
  mystery: ["Fiction", "Mystery & Detective"],
  "detective and mystery stories": ["Fiction", "Mystery & Detective"],
  memoir: ["Biography & Autobiography", "Memoirs"],
  memoirs: ["Biography & Autobiography", "Memoirs"],
  biography: ["Biography & Autobiography"],
  essays: ["Literary Collections", "Essays"],
};

/** A normalised genre path: at most 2 segments, original casing kept for labels. */
type Path = { id: string; segments: string[]; fixedLabels: boolean };

const parentOf = (id: string): string | null => {
  const slash = id.indexOf("/");
  return slash === -1 ? null : id.slice(0, slash);
};

function normaliseSubject(raw: string): Path | null {
  const subject = raw.trim();
  const key = subject.toLowerCase();
  if (!key || isNoiseSubject(key)) return null;

  const synonym = SYNONYMS[key];
  let segments: string[];
  let fixedLabels = false;
  if (synonym) {
    segments = synonym;
    fixedLabels = true;
  } else {
    segments = subject
      .split("/")
      .map((s) => s.trim())
      .filter((s) => s && s.toLowerCase() !== "general");
    // "Fiction / Thrillers / Suspense" and "Fiction / Suspense" are one genre.
    const second = segments[1]?.toLowerCase();
    if (segments[0]?.toLowerCase() === "fiction" && (second === "thrillers" || second === "suspense")) {
      segments = [segments[0], "Thrillers", ...segments.slice(2)];
    }
  }
  segments = segments.slice(0, 2);
  if (segments.length === 0) return null;
  return { id: segments.map((s) => s.toLowerCase()).join("/"), segments, fixedLabels };
}

/** Drops a path when the same book has a deeper one under it ("fiction" beside "fiction/literary"). */
function dropPrefixes(ids: string[]): string[] {
  const unique = [...new Set(ids)];
  return unique.filter((id) => !unique.some((other) => other.startsWith(`${id}/`)));
}

export function buildGenreGraph(books: MapBookInput[]): Omit<ReadingMap, "width" | "height"> | null {
  // Label casings per node id, counted per occurrence; synonym labels win outright.
  const casings = new Map<string, Map<string, number>>();
  const fixedLabel = new Map<string, string>();
  const noteLabel = (id: string, label: string, fixed: boolean) => {
    if (fixed) {
      if (!fixedLabel.has(id)) fixedLabel.set(id, label);
      return;
    }
    let m = casings.get(id);
    if (!m) casings.set(id, (m = new Map()));
    m.set(label, (m.get(label) ?? 0) + 1);
  };

  const sorted = [...books].sort((a, b) => cmp(a.id, b.id));

  // 1–2. Normalised, deduped paths per book.
  const pathsByBook = new Map<string, string[]>();
  for (const b of sorted) {
    const ids: string[] = [];
    for (const raw of b.subjects ?? []) {
      const path = normaliseSubject(raw);
      if (!path) continue;
      const [top, sub] = path.segments;
      const topId = top!.toLowerCase();
      noteLabel(topId, top!, path.fixedLabels);
      if (sub !== undefined) noteLabel(path.id, sub, path.fixedLabels);
      ids.push(path.id);
    }
    pathsByBook.set(b.id, dropPrefixes(ids));
  }

  // 3. Books per path; a child path also counts toward its parent, each book once.
  const counted = countBooks(pathsByBook);
  const initialCount = (id: string) => counted.get(id)?.size ?? 0;
  const qualifies = (id: string) => initialCount(id) >= MIN_GENRE_BOOKS;

  // 4–5. Fall back to a qualifying parent, then keep the best 2 links per book.
  const genreIdsByBook = new Map<string, string[]>();
  for (const [bookId, ids] of pathsByBook) {
    const kept = ids.flatMap((id) => {
      if (qualifies(id)) return [id];
      const parent = parentOf(id);
      return parent && qualifies(parent) ? [parent] : [];
    });
    const chosen = dropPrefixes(kept)
      .sort(
        (a, b) =>
          depthOf(b) - depthOf(a) || initialCount(b) - initialCount(a) || cmp(a, b)
      )
      .slice(0, MAX_LINKS_PER_BOOK);
    genreIdsByBook.set(bookId, chosen.length > 0 ? chosen : [OTHER_ID]);
  }

  // 6. The cap can leave a genre with one book; qualify once more on the
  // capped links. A book of a dropped genre moves to its parent when the
  // parent still qualifies, else to Other. Moving to the parent never lowers
  // the parent's count (the book already counted toward it), so once is enough.
  const cappedCounts = countBooks(genreIdsByBook);
  const stillQualifies = (id: string) =>
    id === OTHER_ID || (cappedCounts.get(id)?.size ?? 0) >= MIN_GENRE_BOOKS;
  for (const [bookId, ids] of genreIdsByBook) {
    const kept = ids.flatMap((id) => {
      if (stillQualifies(id)) return [id];
      const parent = parentOf(id);
      return parent && stillQualifies(parent) ? [parent] : [];
    });
    const deduped = dropPrefixes(kept);
    genreIdsByBook.set(bookId, deduped.length > 0 ? deduped : [OTHER_ID]);
  }

  const mapped = [...genreIdsByBook.values()].filter((ids) => ids[0] !== OTHER_ID).length;
  if (mapped < MIN_MAPPED_BOOKS) return null;

  // 8. Final counts after fallbacks and caps.
  const finalCounts = countBooks(genreIdsByBook);

  const genres: GenreNode[] = [...finalCounts.keys()].sort(cmp).map((id) => {
    const parentId = parentOf(id);
    return {
      kind: "genre",
      id,
      label: id === OTHER_ID ? "Other" : labelFor(id, fixedLabel, casings),
      depth: parentId === null ? 0 : 1,
      parentId,
      bookCount: finalCounts.get(id)!.size,
      x: 0,
      y: 0,
      r: 0,
    };
  });

  const bookNodes: BookNode[] = sorted.map((b) => ({
    kind: "book",
    id: b.id,
    title: b.title,
    author: b.author,
    shelf: b.shelf === "wishlist" ? "wishlist" : "library",
    status: b.status,
    rating: b.rating,
    olRating: b.olRating,
    olRatingCount: b.olRatingCount,
    cover: coverUrls(b.olKey, b.coverId, "M"),
    thumb: coverUrls(b.olKey, b.coverId, "S"),
    genreIds: genreIdsByBook.get(b.id)!,
    x: 0,
    y: 0,
    r: 0,
  }));

  const links: MapLink[] = [
    ...genres.flatMap((g): MapLink[] =>
      g.parentId ? [{ source: g.parentId, target: g.id, kind: "parent" }] : []
    ),
    ...bookNodes.flatMap((b) =>
      b.genreIds.map((genreId): MapLink => ({ source: genreId, target: b.id, kind: "book" }))
    ),
  ];

  const topGenreIds = [...genres]
    .sort((a, b) => b.bookCount - a.bookCount || cmp(a.id, b.id))
    .slice(0, MAX_TOP_GENRES)
    .map((g) => g.id);

  return { genres, books: bookNodes, links, topGenreIds };
}

/** Code-unit comparison: stable across locales, unlike localeCompare. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function depthOf(id: string): number {
  return parentOf(id) === null ? 0 : 1;
}

/** Node id → distinct book ids linked to it or (for a parent) any of its children. */
function countBooks(idsByBook: Map<string, string[]>): Map<string, Set<string>> {
  const counts = new Map<string, Set<string>>();
  const add = (id: string, bookId: string) => {
    let s = counts.get(id);
    if (!s) counts.set(id, (s = new Set()));
    s.add(bookId);
  };
  for (const [bookId, ids] of idsByBook) {
    for (const id of ids) {
      add(id, bookId);
      const parent = parentOf(id);
      if (parent) add(parent, bookId);
    }
  }
  return counts;
}

function labelFor(
  id: string,
  fixedLabel: Map<string, string>,
  casings: Map<string, Map<string, number>>
): string {
  const fixed = fixedLabel.get(id);
  if (fixed) return fixed;
  let label = id.slice(id.indexOf("/") + 1);
  let best = 0;
  // Map iterates in insertion order, so strict > keeps the first-seen casing on ties.
  for (const [casing, n] of casings.get(id) ?? []) {
    if (n > best) [label, best] = [casing, n];
  }
  return label;
}
