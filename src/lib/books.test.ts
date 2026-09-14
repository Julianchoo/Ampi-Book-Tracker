// Run: node --experimental-strip-types --test src/lib/books.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { coverUrls, looksLikeCover, stepPastCandidate } from "./books.ts";

// Every size below was measured against the live endpoints, not guessed.
test("rejects the placeholders both providers serve with a 200", () => {
  for (const [w, h] of [[575, 92], [300, 48], [800, 128], [1, 1]]) {
    assert.equal(looksLikeCover(w!, h!), false, `${w}x${h} should be rejected`);
  }
});

test("keeps real covers, including a square-ish one", () => {
  for (const [w, h] of [[1744, 2649], [575, 873], [128, 195], [337, 500], [465, 475]]) {
    assert.equal(looksLikeCover(w!, h!), true, `${w}x${h} should be kept`);
  }
});

test("google covers go through the resolver, which settles the zoom server-side", () => {
  const urls = coverUrls("google:uf5NEAAAQBAJ", null, "L");
  assert.deepEqual(urls, ["/api/cover/uf5NEAAAQBAJ"]);
});

test("a volume id that needs escaping stays a single safe path segment", () => {
  const [url] = coverUrls("google:a/b?c", null);
  assert.equal(url, "/api/cover/a%2Fb%3Fc");
});

test("open library asks a rung above the display box, and has no second try", () => {
  assert.deepEqual(coverUrls("/works/OL1W", 42, "S"), [
    "https://covers.openlibrary.org/b/id/42-M.jpg",
  ]);
  assert.deepEqual(coverUrls("/works/OL1W", 42, "M"), [
    "https://covers.openlibrary.org/b/id/42-L.jpg",
  ]);
});

test("a book with no cover anywhere yields no candidates", () => {
  assert.deepEqual(coverUrls("/works/OL1W", null), []);
  assert.deepEqual(coverUrls("manual:whatever", null), []);
});

// The regression this guards: next/image reported load twice for one element,
// a blind index+1 skipped the zoom=1 rung, and covers that used to render at
// low res went blank instead.
test("a repeated report for the same candidate only costs one rung", () => {
  const candidates = ["high.jpg", "low.jpg"];
  const afterFirst = stepPastCandidate(candidates, 0, "high.jpg");
  assert.equal(afterFirst, 1);
  assert.equal(stepPastCandidate(candidates, afterFirst, "high.jpg"), 1);
});

test("each distinct candidate failing still walks the list to the end", () => {
  const candidates = ["high.jpg", "low.jpg"];
  const i = stepPastCandidate(candidates, 0, "high.jpg");
  const j = stepPastCandidate(candidates, i, "low.jpg");
  assert.equal(j, 2);
  assert.equal(candidates[j], undefined, "runs out, so the caller shows fallback");
});
