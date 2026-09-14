// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { imageInfo, isPlaceholderCover, type ImageInfo } from "./cover-check.ts";

const png = (w: number, h: number): ImageInfo => ({ format: "PNG", width: w, height: h });
const jpeg = (w: number, h: number): ImageInfo => ({ format: "JPEG", width: w, height: h });

// Every case below is a real measurement from a 73-book library.
test("rejects the stand-ins Google serves with a 200", () => {
  const standins: [ImageInfo, number, string][] = [
    [png(575, 750), 9103, '"image not available", 14 books shared these bytes'],
    [jpeg(575, 829), 246264, "grey placeholder board, 3 books"],
    [png(300, 391), 15567, "the zoom-2 form, 18 books"],
    [png(575, 92), 349, "wide strip"],
    [jpeg(575, 92), 1517, "wide strip, jpeg variant"],
    [png(575, 824), 2935, "flat png, far below photographic density"],
  ];
  for (const [info, bytes, why] of standins) {
    assert.equal(isPlaceholderCover(info, bytes), true, `${info.width}x${info.height} — ${why}`);
  }
});

test("keeps real cover art, including the awkward ones", () => {
  const real: [ImageInfo, number, string][] = [
    [jpeg(575, 766), 23583, "La sombra del viento — nearly the placeholder's shape"],
    [jpeg(575, 873), 42695, "typical"],
    [png(575, 841), 28588, "Medici Money — a real PNG cover just above the flat cutoff"],
    [png(575, 892), 508643, "The Man Who Mistook His Wife — dense PNG"],
    [jpeg(128, 195), 14860, "the zoom-1 fallback itself must never be rejected"],
  ];
  for (const [info, bytes, why] of real) {
    assert.equal(isPlaceholderCover(info, bytes), false, why);
  }
});

test("treats an unreadable response as a stand-in", () => {
  assert.equal(isPlaceholderCover(null, 1234), true);
  assert.equal(isPlaceholderCover(png(0, 0), 1234), true);
});

test("reads dimensions out of real header bytes", () => {
  const p = new Uint8Array(24);
  p.set([0x89, 0x50, 0x4e, 0x47]);
  new DataView(p.buffer).setUint32(16, 575);
  new DataView(p.buffer).setUint32(20, 750);
  assert.deepEqual(imageInfo(p), { format: "PNG", width: 575, height: 750 });

  assert.equal(imageInfo(new Uint8Array(4)), null, "too short to identify");
});
