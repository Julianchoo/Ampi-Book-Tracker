// Run: node --experimental-strip-types --test src/lib/insights.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildInsights, type InsightsBook } from "./insights.ts";

let seq = 0;
function book(overrides: Partial<InsightsBook> = {}): InsightsBook {
  seq++;
  return {
    id: `b${String(seq).padStart(3, "0")}`,
    title: `Book ${seq}`,
    author: null,
    olKey: `/works/OL${seq}W`,
    coverId: null,
    subjects: null,
    shelf: "library",
    status: "finished",
    rating: null,
    olRating: null,
    olRatingCount: null,
    finishedAt: null,
    firstPublishYear: null,
    ...overrides,
  };
}

const read = (subject: string, overrides: Partial<InsightsBook> = {}) =>
  book({ subjects: [subject], ...overrides });
const wish = (subject: string, overrides: Partial<InsightsBook> = {}) =>
  book({ shelf: "wishlist", status: null, subjects: [subject], ...overrides });

const allTime = (books: InsightsBook[]) => buildInsights(books, { range: "all", year: 2026 });
const inYear = (books: InsightsBook[], year = 2026) => buildInsights(books, { range: "year", year });

/** Three thrillers keep buildGenreGraph above its "enough mapped books" floor. */
const filler = () => [
  read("Fiction / Thrillers", { rating: 7 }),
  read("Fiction / Thrillers", { rating: 7 }),
  read("Fiction / Thrillers", { rating: 7 }),
];

const bubble = (i: ReturnType<typeof allTime>, id: string) => i.bubbles.find((b) => b.id === id);

test("the read side is finished library books, and the year filter moves only it", () => {
  const books = [
    ...filler(),
    read("History", { rating: 8, finishedAt: "2026-04-01" }),
    read("History", { rating: 6, finishedAt: "2025-11-30" }),
    read("History", { status: "reading" }),
    read("History", { status: "abandoned", finishedAt: "2026-02-02" }),
    wish("Science Fiction"),
    wish("Science Fiction"),
  ];
  assert.deepEqual(allTime(books).counts, { read: 5, pending: 2, rated: 5 });
  assert.deepEqual(inYear(books).counts, { read: 1, pending: 2, rated: 1 });
  // The wishlist has no date, so its rings are the same in either range.
  const ring = (i: ReturnType<typeof allTime>) =>
    i.pendingGenres.find((g) => g.id === "fiction/science fiction")?.pending;
  assert.equal(ring(allTime(books)), 2);
  assert.equal(ring(inYear(books)), 2);
});

test("the catch-all Other genre is never a bubble", () => {
  const books = [...filler(), read("Pottery", { rating: 9 }), read("Basket Weaving", { rating: 9 })];
  const insights = allTime(books);
  assert.deepEqual(
    insights.bubbles.map((b) => b.id),
    ["fiction", "fiction/thrillers"]
  );
  assert.equal(insights.booksByGenre["other"], undefined);
});

test("a bubble needs two read books in range and at least one rating", () => {
  const books = [
    ...filler(),
    read("History", { rating: 8 }),
    read("History", { rating: 6 }),
    read("Cookery", { rating: 10 }), // one book: never its own genre
    read("Travel"),
    read("Travel"), // two books, no rating: no average to place it at
  ];
  const insights = allTime(books);
  assert.deepEqual(
    insights.bubbles.map((b) => [b.id, b.read, b.rated, b.avgRating]),
    [
      ["fiction", 3, 3, 7],
      ["fiction/thrillers", 3, 3, 7],
      ["history", 2, 2, 7],
    ]
  );
  // Unrated but real: it is not a bubble, and it is not "not started" either.
  assert.equal(insights.pendingGenres.length, 0);
});

test("genres with only wishlist books go to the not-started strip, ordered by size", () => {
  const books = [
    ...filler(),
    wish("History"),
    wish("History"),
    wish("History"),
    wish("Science Fiction"),
    wish("Science Fiction"),
  ];
  const insights = allTime(books);
  assert.deepEqual(
    insights.pendingGenres,
    [
      { id: "history", label: "History", pending: 3 },
      { id: "fiction/science fiction", label: "Science Fiction", pending: 2 },
    ]
  );
  assert.deepEqual(insights.bubbles.map((b) => b.id), ["fiction", "fiction/thrillers"]);
});

test("bubbles sort by books read, then label", () => {
  const books = [
    ...filler(),
    read("History", { rating: 8 }),
    read("History", { rating: 8 }),
    read("Art", { rating: 5 }),
    read("Art", { rating: 5 }),
  ];
  assert.deepEqual(
    allTime(books).bubbles.map((b) => b.label),
    ["Fiction", "Thrillers", "Art", "History"]
  );
});

test("the rating axis fits the real band instead of 0-10", () => {
  const books = [
    read("Fiction / Thrillers", { rating: 5.5 }),
    read("Fiction / Thrillers", { rating: 5.5 }),
    read("History", { rating: 8 }),
    read("History", { rating: 7.5 }),
    read("Art", { rating: 6.5 }),
    read("Art", { rating: 6.5 }),
  ];
  // min 5.5, max 7.8 (history averages 7.75 -> 7.8)
  assert.deepEqual(allTime(books).ratingDomain, [5.2, 8.1]);
});

test("one bubble falls back to a window around it, and a domain is never narrower than 1", () => {
  const one = [read("History", { rating: 7 }), read("History", { rating: 7 }), read("History", { rating: 7 })];
  assert.deepEqual(allTime(one).bubbles.length, 1);
  assert.deepEqual(allTime(one).ratingDomain, [6, 8]);

  const flat = [
    ...filler(),
    read("History", { rating: 7 }),
    read("History", { rating: 7 }),
  ];
  // Every genre averages 7.0, so padding alone would give a zero-wide axis.
  const domain = allTime(flat).ratingDomain;
  assert.deepEqual(domain, [6.5, 7.5]);
  assert.ok(domain[1] - domain[0] >= 1);
});

test("the domain stays inside 0-10 at the ends of the scale", () => {
  const books = [read("Fiction / Thrillers", { rating: 10 }), read("Fiction / Thrillers", { rating: 10 }), ...filler()];
  const [low, high] = allTime([...books]).ratingDomain;
  assert.ok(low >= 0 && high <= 10);
});

test("decades bucket by publication year and keep empty decades between", () => {
  const books = [
    ...filler(),
    read("History", { rating: 8, firstPublishYear: 1954 }),
    read("History", { rating: 6, firstPublishYear: 1958 }),
    read("History", { rating: 7, firstPublishYear: 1981 }),
    read("History"), // no year: no decade
  ];
  assert.deepEqual(
    allTime(books).decades,
    [
      { decade: 1950, label: "1950s", books: 2, rated: 2, avgRating: 7 },
      { decade: 1960, label: "1960s", books: 0, rated: 0, avgRating: null },
      { decade: 1970, label: "1970s", books: 0, rated: 0, avgRating: null },
      { decade: 1980, label: "1980s", books: 1, rated: 1, avgRating: 7 },
    ]
  );
  assert.deepEqual(allTime([...filler()]).decades, []);
});

test("the decade caption needs two decades with three ratings each", () => {
  const decade = (year: number, ratings: number[]) =>
    ratings.map((rating) => read("History", { rating, firstPublishYear: year }));
  const thin = [...filler(), ...decade(2010, [8, 7, 7.5]), ...decade(2020, [6, 5])];
  assert.equal(allTime(thin).decadesNote, null);

  const full = [...filler(), ...decade(2010, [8, 7, 7.5]), ...decade(2020, [6, 5, 7])];
  assert.equal(allTime(full).decadesNote, "Your 2010s books score best (7.5); the 2020s trail at 6.0.");

  const tied = [...filler(), ...decade(2010, [7, 7, 7]), ...decade(2020, [7, 7, 7])];
  assert.equal(allTime(tied).decadesNote, null);
});

test("rating buckets run from the lowest rating given to the highest, with no empty tails", () => {
  const books = [...filler(), read("History", { rating: 8.5 }), read("History", { rating: 6 })];
  assert.deepEqual(
    allTime(books).ratings,
    [
      { rating: 6, books: 1 },
      { rating: 6.5, books: 0 },
      { rating: 7, books: 3 },
      { rating: 7.5, books: 0 },
      { rating: 8, books: 0 },
      { rating: 8.5, books: 1 },
    ]
  );
  assert.equal(allTime(books).avgRating, 7.1);
});

test("the ratings note waits for five ratings", () => {
  const four = [...filler(), read("History", { rating: 8 })];
  assert.equal(allTime(four).ratingsNote, null);

  const five = [...filler(), read("History", { rating: 8 }), read("History", { rating: 9 })];
  assert.equal(allTime(five).ratingsNote, "You give 7 most often — 80% of your ratings land between 6.6 and 8.6.");
  assert.equal(allTime([]).ratingsNote, null);
});

test("booksByGenre lists read books best-first, then the pending ones by title", () => {
  const books = [
    ...filler(),
    read("History", { id: "h-low", title: "Alpha", rating: 6, author: "A" }),
    read("History", { id: "h-top", title: "Zulu", rating: 9 }),
    read("History", { id: "h-none", title: "Beta" }),
    wish("History", { id: "h-w2", title: "Wishlist Two" }),
    wish("History", { id: "h-w1", title: "Wishlist One" }),
  ];
  assert.deepEqual(
    allTime(books).booksByGenre["history"],
    [
      { id: "h-top", title: "Zulu", author: null, rating: 9, pending: false },
      { id: "h-low", title: "Alpha", author: "A", rating: 6, pending: false },
      { id: "h-none", title: "Beta", author: null, rating: null, pending: false },
      { id: "h-w1", title: "Wishlist One", author: null, rating: null, pending: true },
      { id: "h-w2", title: "Wishlist Two", author: null, rating: null, pending: true },
    ]
  );
  assert.deepEqual(
    bubble(allTime(books), "history")!.topBooks,
    [
      { id: "h-top", title: "Zulu", rating: 9 },
      { id: "h-low", title: "Alpha", rating: 6 },
      { id: "h-none", title: "Beta", rating: null },
    ]
  );
});

test("an empty shelf gives an empty but usable shape", () => {
  const insights = allTime([]);
  assert.deepEqual(insights.bubbles, []);
  assert.deepEqual(insights.decades, []);
  assert.deepEqual(insights.ratings, []);
  assert.equal(insights.avgRating, null);
  assert.equal(insights.decadesNote, null);
  assert.deepEqual(insights.ratingDomain, [4, 6]);
});

test("the same books in any order give the same insights", () => {
  const books = [
    ...filler(),
    read("History", { rating: 8, firstPublishYear: 1999 }),
    read("History", { rating: 6, firstPublishYear: 2004 }),
    wish("Science Fiction"),
    wish("Science Fiction"),
  ];
  assert.deepEqual(allTime([...books].reverse()), allTime(books));
});
