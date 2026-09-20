// Run: node --experimental-strip-types --test src/lib/constellation.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGenreGraph, type MapBookInput } from "./constellation.ts";

let seq = 0;
function book(overrides: Partial<MapBookInput> = {}): MapBookInput {
  seq++;
  return {
    id: `b${String(seq).padStart(3, "0")}`,
    title: `Book ${seq}`,
    author: null,
    olKey: `/works/OL${seq}W`,
    coverId: null,
    subjects: null,
    shelf: "library",
    status: null,
    rating: null,
    olRating: null,
    olRatingCount: null,
    ...overrides,
  };
}

const withSubjects = (...subjects: string[]) => book({ subjects });
const graph = (books: MapBookInput[]) => {
  const g = buildGenreGraph(books);
  assert.ok(g, "expected a graph");
  return g;
};
const genreIds = (books: MapBookInput[]) => graph(books).genres.map((g) => g.id);
const linksOf = (books: MapBookInput[], id: string) => graph(books).books.find((b) => b.id === id)!.genreIds;

test("drops General segments and truncates to two levels", () => {
  const books = [
    withSubjects("Fiction / Thrillers / Psychological"),
    withSubjects("Fiction / Thrillers / General"),
    withSubjects("Fiction / General"),
    withSubjects("Fiction / Thrillers"),
  ];
  assert.deepEqual(genreIds(books), ["fiction", "fiction/thrillers"]);
});

test("synonyms merge flat subjects into BISAC paths, with the map's casing", () => {
  const books = [withSubjects("Literary Fiction"), withSubjects("Fiction / Literary"), withSubjects("literary")];
  const g = graph(books);
  assert.deepEqual(g.genres.map((n) => [n.id, n.label, n.bookCount]), [
    ["fiction", "Fiction", 3],
    ["fiction/literary", "Literary", 3],
  ]);
});

test("Suspense and Thrillers under Fiction merge", () => {
  const books = [
    withSubjects("Fiction / Suspense"),
    withSubjects("Fiction / Thrillers / Suspense"),
    withSubjects("Thriller"),
  ];
  assert.deepEqual(genreIds(books), ["fiction", "fiction/thrillers"]);
});

test("BISAC shelf segments are not genres: Places is dropped", () => {
  const remains = withSubjects("Fiction / Places / Europe");
  const books = [remains, withSubjects("Fiction / Literary"), withSubjects("Fiction / Literary")];
  const g = graph(books);
  assert.ok(!g.genres.some((n) => n.id.includes("places")));
  assert.deepEqual(g.books.find((b) => b.id === remains.id)!.genreIds, ["fiction"]);
});

test("a pivot segment truncates rather than closing up: two books share Fiction, not Europe", () => {
  const books = [
    withSubjects("Fiction / Places / Europe"),
    withSubjects("Fiction / Places / Europe"),
    withSubjects("Fiction / Literary"),
  ];
  const g = graph(books);
  // Two books share "Europe", so dropping "Places" and closing the path up
  // would qualify it as a genre node — the exact bug this is here to catch.
  assert.deepEqual(g.genres.map((n) => n.id), ["fiction"]);
});

test("…and Women under Biography & Autobiography", () => {
  const educated = withSubjects("Biography & Autobiography / Women");
  const books = [
    educated,
    withSubjects("Biography & Autobiography / Memoirs"),
    withSubjects("Biography & Autobiography / Memoirs"),
  ];
  const g = graph(books);
  assert.ok(!g.genres.some((n) => n.id.includes("women")));
  assert.deepEqual(g.books.find((b) => b.id === educated.id)!.genreIds, ["biography & autobiography"]);
});

test("Young Adult Fiction folds into the Fiction tree, joining flat synonyms", () => {
  const ya = withSubjects("Young Adult Fiction / Fantasy / Dark Fantasy");
  const flat = withSubjects("Fantasy");
  const books = [ya, flat, withSubjects("Fantasy")];
  const g = graph(books);
  assert.ok(!g.genres.some((n) => n.id.includes("young adult")));
  assert.deepEqual(g.books.find((b) => b.id === ya.id)!.genreIds, ["fiction/fantasy"]);
  assert.deepEqual(g.books.find((b) => b.id === flat.id)!.genreIds, ["fiction/fantasy"]);
});

test("the Fiction fold runs before the Suspense fold", () => {
  const ya = withSubjects("Young Adult Fiction / Thrillers / Suspense");
  const books = [ya, withSubjects("Fiction / Thrillers"), withSubjects("Fiction / Thrillers")];
  assert.deepEqual(linksOf(books, ya.id), ["fiction/thrillers"]);
});

test("labels use the most frequent casing", () => {
  const books = [
    withSubjects("History / Europe"),
    withSubjects("HISTORY / EUROPE"),
    withSubjects("History / Europe"),
  ];
  assert.deepEqual(graph(books).genres.map((n) => n.label), ["History", "Europe"]);
});

test("a book's shallower path is dropped when it has a deeper one under it", () => {
  const a = withSubjects("Fiction", "Fiction / Literary");
  const books = [a, withSubjects("Fiction / Literary"), withSubjects("Fiction / Literary")];
  assert.deepEqual(linksOf(books, a.id), ["fiction/literary"]);
});

test("a genre needs two books; otherwise the book falls back to a qualifying parent", () => {
  const lone = withSubjects("Fiction / Westerns");
  const books = [lone, withSubjects("Fiction / Horror"), withSubjects("Fiction / Horror"), withSubjects("Poetry")];
  const g = graph(books);
  assert.deepEqual(g.genres.map((n) => n.id), ["fiction", "fiction/horror", "other"]);
  assert.deepEqual(g.books.find((b) => b.id === lone.id)!.genreIds, ["fiction"]);
});

test("books with no usable genre link to Other, created only when needed", () => {
  const none = book();
  const books = [none, withSubjects("Fantasy"), withSubjects("Fantasy"), withSubjects("Fantasy")];
  const g = graph(books);
  const other = g.genres.find((n) => n.id === "other")!;
  assert.deepEqual([other.label, other.depth, other.bookCount], ["Other", 0, 1]);
  assert.deepEqual(g.books.find((b) => b.id === none.id)!.genreIds, ["other"]);
  assert.ok(!genreIds(books.slice(1)).includes("other"));
});

test("at most two links per book, preferring depth then the book's own order", () => {
  const many = withSubjects("Fiction / Horror", "Fiction / Fantasy", "History / Europe", "Fiction / Literary");
  const books = [
    many,
    withSubjects("Fiction / Horror"),
    withSubjects("Fiction / Fantasy"),
    withSubjects("Fiction / Fantasy"),
    withSubjects("History / Europe"),
    withSubjects("History / Europe"),
    withSubjects("History / Europe"),
  ];
  // Horror and Fantasy come first for this book even though History/Europe has
  // four books and Horror two; Literary (1) falls back to fiction, which is
  // shallower. Ranking by shelf-wide popularity is what files A Game of
  // Thrones under Science Fiction.
  assert.deepEqual(linksOf(books, many.id), ["fiction/horror", "fiction/fantasy"]);
});

test("a deeper genre still beats an earlier shallower one", () => {
  const many = withSubjects("History", "Fiction / Horror");
  const books = [many, withSubjects("History"), withSubjects("Fiction / Horror")];
  assert.deepEqual(linksOf(books, many.id), ["fiction/horror", "history"]);
});

test("a genre left with one book by the cap is dropped; its book falls back to Other", () => {
  // `many` caps to its first two, Horror + Europe, leaving Travel/Asia with `lone` only.
  const many = withSubjects("Fiction / Horror", "History / Europe", "Travel / Asia");
  const lone = withSubjects("Travel / Asia");
  const books = [
    many,
    lone,
    withSubjects("Fiction / Horror"),
    withSubjects("Fiction / Horror"),
    withSubjects("History / Europe"),
    withSubjects("History / Europe"),
  ];
  const g = graph(books);
  assert.ok(!g.genres.some((n) => n.id.startsWith("travel")));
  assert.deepEqual(g.books.find((b) => b.id === lone.id)!.genreIds, ["other"]);
  assert.ok(g.genres.every((n) => n.id === "other" || n.bookCount >= 2));
});

test("…or to its parent when the parent still has two books", () => {
  const many = withSubjects("Fiction / Horror", "History / Europe", "Travel / Asia");
  const lone = withSubjects("Travel / Asia");
  const books = [
    many,
    lone,
    withSubjects("Travel / Andes"), // alone in its child, so it already sits on Travel
    withSubjects("Fiction / Horror"),
    withSubjects("Fiction / Horror"),
    withSubjects("History / Europe"),
    withSubjects("History / Europe"),
  ];
  const g = graph(books);
  assert.ok(!g.genres.some((n) => n.id === "travel/asia"));
  assert.deepEqual(g.books.find((b) => b.id === lone.id)!.genreIds, ["travel"]);
  assert.equal(g.genres.find((n) => n.id === "travel")!.bookCount, 2);
});

test("bookCount counts distinct books, a parent once per book across children", () => {
  const books = [
    withSubjects("Fiction / Horror", "Fiction / Fantasy"),
    withSubjects("Fiction / Horror"),
    withSubjects("Fiction / Fantasy"),
  ];
  const counts = Object.fromEntries(graph(books).genres.map((n) => [n.id, n.bookCount]));
  assert.deepEqual(counts, { fiction: 3, "fiction/fantasy": 2, "fiction/horror": 2 });
});

test("links: parent links then book links", () => {
  const books = [withSubjects("Fiction / Horror"), withSubjects("Fiction / Horror"), withSubjects("Fiction / Horror")];
  const g = graph(books);
  assert.deepEqual(g.links[0], { source: "fiction", target: "fiction/horror", kind: "parent" });
  assert.equal(g.links.filter((l) => l.kind === "book").length, 3);
});

test("topGenreIds: by count desc then id, capped at 6", () => {
  const books: MapBookInput[] = [];
  const topics = ["A", "B", "C", "D", "E", "F", "G"];
  topics.forEach((t, i) => {
    for (let n = 0; n < 2 + (i === 6 ? 3 : 0); n++) books.push(withSubjects(t));
  });
  assert.deepEqual(graph(books).topGenreIds, ["g", "a", "b", "c", "d", "e"]);
});

test("null when fewer than three books map to a real genre", () => {
  assert.equal(buildGenreGraph([withSubjects("Horror"), withSubjects("Horror"), book(), book()]), null);
  assert.equal(buildGenreGraph([]), null);
});

test("noise subjects are ignored; shelf and cover are normalised", () => {
  const w = book({ subjects: ["Accessible book", "Horror"], shelf: "wishlist", coverId: 42 });
  const books = [w, withSubjects("Horror"), withSubjects("Horror")];
  const g = graph(books);
  assert.ok(!g.genres.some((n) => n.id.includes("accessible")));
  const node = g.books.find((b) => b.id === w.id)!;
  assert.equal(node.shelf, "wishlist");
  assert.deepEqual(node.cover, ["https://covers.openlibrary.org/b/id/42-L.jpg"]);
  assert.deepEqual(node.thumb, ["https://covers.openlibrary.org/b/id/42-M.jpg"]);
});

test("deterministic regardless of input order", () => {
  const books = [
    withSubjects("Fiction / Horror", "Soviet Union"),
    withSubjects("Horror"),
    withSubjects("Fiction / Literary", "Essays"),
    withSubjects("Memoirs", "Essays"),
    withSubjects("Biography & Autobiography / Memoirs"),
  ];
  assert.deepEqual(buildGenreGraph(books), buildGenreGraph([...books].reverse()));
});
