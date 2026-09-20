// Run: node --experimental-strip-types --test src/lib/googlebooks.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesStoredTitle, pickBisacCategories } from "./googlebooks.ts";

// Trimmed from the live response for The Silent Patient.
const SILENT_PATIENT = [
  "Fiction / Thrillers / Psychological",
  "Fiction / Psychological",
  "Fiction / Thrillers / Suspense",
  "Religion / Ancient",
  "Psychology / Assessment, Testing & Measurement",
  "Art / History / Ancient & Classical",
  "Medical / Ethics",
];

test("keeps the dominant family and drops the unrelated tail", () => {
  assert.deepEqual(pickBisacCategories(SILENT_PATIENT), [
    "Fiction / Thrillers / Psychological",
    "Fiction / Psychological",
    "Fiction / Thrillers / Suspense",
  ]);
});

test("a tie goes to the family seen first", () => {
  assert.deepEqual(
    pickBisacCategories(["History / Europe", "Science / Space", "History / Ancient", "Science / Physics"]),
    ["History / Europe", "History / Ancient"]
  );
});

test("caps the output at max, in input order", () => {
  const many = ["Fiction / A", "Fiction / B", "Fiction / C", "Fiction / D"];
  assert.deepEqual(pickBisacCategories(many, 2), ["Fiction / A", "Fiction / B"]);
  assert.deepEqual(pickBisacCategories(many), many);
});

test("empty input is empty output", () => {
  assert.deepEqual(pickBisacCategories([]), []);
});

// Google mixes bare families in with full paths; "Fiction" is its own family.
test("a category with no slash counts as its own family", () => {
  assert.deepEqual(pickBisacCategories(["Fiction", "Fiction / Fantasy", "History / Europe"]), [
    "Fiction",
    "Fiction / Fantasy",
  ]);
  assert.deepEqual(pickBisacCategories(["Fiction"]), ["Fiction"]);
});

test("entries are trimmed and blank ones skipped", () => {
  assert.deepEqual(pickBisacCategories(["  Fiction / Fantasy  ", "   ", "", "fiction / Epic"]), [
    "Fiction / Fantasy",
    "fiction / Epic",
  ]);
});

// Every row measured against the live API — each false is a wrong volume the
// title search actually returned.
test("rejects translations, foreign editions and study guides", () => {
  assert.equal(matchesStoredTitle("Dune", "Crónicas de Dune"), false);
  assert.equal(matchesStoredTitle("Sapiens", "Sapiens. De animales a dioses"), false);
  assert.equal(matchesStoredTitle("The Silent Patient", "Summary of The Silent Patient"), false);
});

test("accepts the same volume with and without its subtitle", () => {
  assert.equal(matchesStoredTitle("Dune", "Dune: The Graphic Novel"), true);
  assert.equal(matchesStoredTitle("The Remains of the Day", "The Remains of the Day"), true);
});

// Google returns accented and straight-quoted spellings of the same volume.
test("diacritics, case and punctuation style do not block a match", () => {
  assert.equal(matchesStoredTitle("Les Misérables", "Les Miserables"), true);
  assert.equal(matchesStoredTitle("The Handmaid's Tale", "the handmaid’s tale"), true);
  // An apostrophe the other side simply dropped is still the same book.
  assert.equal(matchesStoredTitle("The Handmaid's Tale", "The Handmaids Tale"), true);
  assert.equal(matchesStoredTitle("Sapiens — A Brief History", "Sapiens - A Brief History"), true);
});

test("an empty or subtitle-only title never matches", () => {
  assert.equal(matchesStoredTitle("", ""), false);
  assert.equal(matchesStoredTitle("Dune", ""), false);
  assert.equal(matchesStoredTitle(": A Novel", "Dune"), false);
});
