// Run: node --experimental-strip-types --test src/lib/openlibrary.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRatingSearch, ratingQuery } from "./openlibrary.ts";

test("rating query collapses whitespace and tolerates a missing author", () => {
  assert.equal(ratingQuery("  Project Hail Mary:\n A Novel ", " Andy  Weir"), "Project Hail Mary: A Novel Andy Weir");
  assert.equal(ratingQuery("Dune", null), "Dune");
  assert.equal(ratingQuery("Dune", undefined), "Dune");
});

test("reads average and count from the first doc", () => {
  assert.deepEqual(parseRatingSearch({ docs: [{ ratings_average: 4.5, ratings_count: 178 }] }), {
    average: 4.5,
    count: 178,
  });
});

// Open Library omits the rating fields on unrated docs rather than sending 0.
test("an unrated or missing doc is an answer of zero, not a failure", () => {
  for (const json of [{ docs: [{ key: "/works/X" }] }, { docs: [] }, {}, null, { docs: [{ ratings_average: 0, ratings_count: 0 }] }]) {
    assert.deepEqual(parseRatingSearch(json), { average: null, count: 0 }, JSON.stringify(json));
  }
});
