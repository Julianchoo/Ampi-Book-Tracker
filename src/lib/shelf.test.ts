// Run: node --experimental-strip-types --test src/lib/shelf.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterBooks,
  groupByYear,
  hasActiveFilters,
  libraryHighlights,
  parseShelfParams,
  pickStaleForRating,
  readingDays,
  type ShelfBook,
  type ShelfFilters,
  shouldGroup,
  statusCounts,
  topSubjects,
  wishlistHighlights,
} from "./shelf.ts";

let seq = 0;
function book(overrides: Partial<ShelfBook> = {}): ShelfBook {
  seq++;
  return {
    id: `b${seq}`,
    title: `Book ${seq}`,
    author: null,
    status: null,
    rating: null,
    pages: null,
    subjects: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    olRating: null,
    olRatingCount: null,
    collectionIds: [],
    ...overrides,
  };
}

const UUID = "0b7c6a1e-3f4d-4e5a-9b8c-7d6e5f4a3b2c";
const noFilters: ShelfFilters = parseShelfParams({}, "library");
const ids = (books: ShelfBook[]) => books.map((b) => b.id);

test("parseShelfParams falls back on anything invalid", () => {
  assert.deepEqual(parseShelfParams({ status: "lost", sort: "nope", view: "list", collection: "abc" }, "library"), {
    status: undefined,
    subject: undefined,
    author: undefined,
    collection: undefined,
    sort: "recent",
    view: "grid",
  });
});

test("parseShelfParams keeps valid values, takes the first of an array, trims text", () => {
  const f = parseShelfParams(
    { status: ["reading", "finished"], subject: "  Fantasy ", author: "", collection: UUID, sort: "title", view: "wall" },
    "library"
  );
  assert.equal(f.status, "reading");
  assert.equal(f.subject, "Fantasy");
  assert.equal(f.author, undefined);
  assert.equal(f.collection, UUID);
  assert.equal(f.sort, "title");
  assert.equal(f.view, "wall");
  assert.equal(parseShelfParams({ author: "x".repeat(201) }, "library").author, undefined);
});

test("status is ignored on the wishlist, and sorts are shelf-specific", () => {
  const f = parseShelfParams({ status: "reading", sort: "rating" }, "wishlist");
  assert.equal(f.status, undefined);
  assert.equal(f.sort, "added");
  assert.equal(parseShelfParams({ sort: "community" }, "wishlist").sort, "community");
  assert.equal(parseShelfParams({ sort: "community" }, "library").sort, "recent");
});

test("hasActiveFilters ignores sort and view", () => {
  assert.equal(hasActiveFilters(parseShelfParams({ sort: "title", view: "wall" }, "library")), false);
  assert.equal(hasActiveFilters(parseShelfParams({ subject: "x" }, "library")), true);
});

test("filterBooks matches subject and author case-insensitively, and by collection", () => {
  const a = book({ subjects: ["Science Fiction"], author: "Ursula K. Le Guin", collectionIds: [UUID] });
  const b = book({ subjects: ["History"], author: "Mary Beard" });
  const books = [a, b];
  assert.deepEqual(ids(filterBooks(books, { ...noFilters, subject: "science fiction" })), [a.id]);
  assert.deepEqual(ids(filterBooks(books, { ...noFilters, author: " mary beard " })), [b.id]);
  assert.deepEqual(ids(filterBooks(books, { ...noFilters, collection: UUID })), [a.id]);
});

test("filterBooks can skip the status filter so chips count the other filters", () => {
  const books = [book({ status: "reading" }), book({ status: "finished" })];
  const f = { ...noFilters, status: "reading" as const };
  assert.equal(filterBooks(books, f).length, 1);
  assert.equal(filterBooks(books, f, { ignoreStatus: true }).length, 2);
});

test("statusCounts counts null-status books only in all", () => {
  const books = [book({ status: "reading" }), book({ status: "finished" }), book({ status: "finished" }), book()];
  assert.deepEqual(statusCounts(books), { all: 4, reading: 1, finished: 2, abandoned: 0 });
});

test("topSubjects dedupes casing, drops Open Library noise, orders and caps", () => {
  const books = [
    book({ subjects: ["fantasy", "Accessible book", "OverDrive Fiction", "nyt:hardcover-fiction=2020", "Fiction"] }),
    book({ subjects: ["Fantasy", "History", "Protected DAISY"] }),
    book({ subjects: ["Fantasy", "Art"] }),
  ];
  assert.deepEqual(topSubjects(books), ["Fantasy", "Art", "Fiction", "History"]);
  assert.deepEqual(topSubjects(books, 2), ["Fantasy", "Art"]);
});

test("readingDays is inclusive and rejects bad ranges", () => {
  assert.equal(readingDays("2025-03-01", "2025-03-01"), 1);
  assert.equal(readingDays("2025-02-27", "2025-03-01"), 3);
  assert.equal(readingDays("2025-03-02", "2025-03-01"), null);
  assert.equal(readingDays(null, "2025-03-01"), null);
  assert.equal(readingDays("garbage", "2025-03-01"), null);
});

test("groupByYear orders sections and routes edge cases", () => {
  const r = book({ status: "reading" });
  const old = book({ status: "finished", finishedAt: "2023-05-01", pages: 100 });
  const newer = book({ status: "finished", finishedAt: "2025-01-10", pages: 4000, rating: 8 });
  const newer2 = book({ status: "finished", finishedAt: "2025-06-10", pages: 320, rating: 8 });
  const abandoned = book({ status: "abandoned", finishedAt: "2025-02-01" });
  const noDate = book();
  const sections = groupByYear([old, abandoned, newer, noDate, r, newer2]);

  assert.deepEqual(
    sections.map((s) => [s.key, s.title, ids(s.books)]),
    [
      ["reading", "Reading", [r.id]],
      ["year-2025", "2025", [newer.id, newer2.id]],
      ["year-2023", "2023", [old.id]],
      ["no-date", "No date", [noDate.id]],
      ["abandoned", "Abandoned", [abandoned.id]],
    ]
  );
  assert.equal(sections[1]!.summary, "2 books · 4,320 pages · avg 8.0");
  assert.equal(sections[2]!.summary, "1 book · 100 pages");
  assert.equal(sections[3]!.summary, "1 book");
});

test("groupByYear omits pages when none are known", () => {
  const [section] = groupByYear([book({ finishedAt: "2024-01-01", rating: 7.5 })]);
  assert.equal(section!.summary, "1 book · avg 7.5");
});

test("shouldGroup only for the default library view", () => {
  assert.equal(shouldGroup("library", noFilters), true);
  assert.equal(shouldGroup("library", { ...noFilters, status: "finished" }), true);
  assert.equal(shouldGroup("library", { ...noFilters, status: "reading" }), false);
  assert.equal(shouldGroup("library", { ...noFilters, status: "abandoned" }), false);
  assert.equal(shouldGroup("library", { ...noFilters, sort: "title" }), false);
  assert.equal(shouldGroup("wishlist", noFilters), false);
});

test("libraryHighlights prefers this year and never features a book twice", () => {
  // `star` is top rated AND longest AND quickest; the others must take the remaining slots.
  const star = book({ status: "finished", finishedAt: "2026-02-02", startedAt: "2026-02-02", rating: 9.5, pages: 900 });
  const long = book({ status: "finished", finishedAt: "2026-03-10", startedAt: "2026-03-01", rating: 6, pages: 1200 });
  const quick = book({ status: "finished", finishedAt: "2026-04-03", startedAt: "2026-04-01", pages: 150 });
  const lastYear = book({ status: "finished", finishedAt: "2025-01-01", rating: 10 });
  const h = libraryHighlights([lastYear, star, long, quick], 2026);
  assert.equal(h!.title, "2026 highlights");
  assert.deepEqual(
    h!.items.map((i) => [i.label, i.value, i.book.id]),
    [
      ["Top rated", "9.5/10", star.id],
      ["Longest", "1,200 pages", long.id],
      ["Quickest read", "Read in 3 days", quick.id],
    ]
  );
});

test("libraryHighlights falls back to all time, and to null with nothing finished", () => {
  const b = book({ status: "finished", finishedAt: "2020-01-01", rating: 8 });
  const h = libraryHighlights([b, book({ status: "reading" })], 2026);
  assert.equal(h!.title, "All-time highlights");
  assert.deepEqual(h!.items.map((i) => i.value), ["8/10"]);
  assert.equal(libraryHighlights([book({ status: "reading" })], 2026), null);
});

test("wishlistHighlights respects the community rating threshold", () => {
  const short = book({ pages: 212, createdAt: new Date("2025-06-01T00:00:00Z") });
  const oldest = book({ createdAt: new Date("2025-03-15T00:00:00Z") });
  const later = new Date("2025-07-01T00:00:00Z");
  const noisy = book({ olRating: 5, olRatingCount: 1, createdAt: later });
  const solid = book({ olRating: 4.25, olRatingCount: 444, createdAt: later });
  const h = wishlistHighlights([short, oldest, noisy, solid]);
  assert.deepEqual(
    h!.items.map((i) => [i.label, i.value, i.book.id]),
    [
      ["Shortest", "212 pages", short.id],
      ["Waiting longest", "Added Mar 2025", oldest.id],
      ["Best rated on Open Library", "4.3/5", solid.id],
    ]
  );
  assert.equal(wishlistHighlights([]), null);
});

test("pickStaleForRating puts never-checked first, then oldest past the TTL, capped", () => {
  const now = new Date("2026-09-17T00:00:00Z");
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
  const fresh = { id: "fresh", olRatingCheckedAt: daysAgo(10) };
  const stale40 = { id: "stale40", olRatingCheckedAt: daysAgo(40) };
  const stale90 = { id: "stale90", olRatingCheckedAt: daysAgo(90) };
  const never1 = { id: "never1", olRatingCheckedAt: null };
  const never2 = { id: "never2", olRatingCheckedAt: null };
  const books = [fresh, stale40, never1, stale90, never2];
  assert.deepEqual(
    pickStaleForRating(books, now).map((b) => b.id),
    ["never1", "never2", "stale90", "stale40"]
  );
  assert.deepEqual(
    pickStaleForRating(books, now, 3).map((b) => b.id),
    ["never1", "never2", "stale90"]
  );
});
