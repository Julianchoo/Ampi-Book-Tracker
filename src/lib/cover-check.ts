/**
 * Telling a real cover from Google's stand-in graphics.
 *
 * The content endpoint answers 200 for every zoom. When a volume has no scan
 * at that size it serves a stand-in instead of an error, so the only way to
 * know is to look at the bytes — which is why this runs on the server and the
 * browser is handed the winner. Every number below was measured against a
 * 73-book library, not guessed; see the fingerprints for what that found.
 */

export type ImageInfo = { format: "PNG" | "GIF" | "JPEG"; width: number; height: number };

/** Pixel dimensions and format from the header bytes. Null if unrecognised. */
export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 24) return null;

  if (bytes[0] === 0x89 && bytes[1] === 0x50)
    return { format: "PNG", width: v.getUint32(16), height: v.getUint32(20) };

  if (bytes[0] === 0x47 && bytes[1] === 0x49)
    return { format: "GIF", width: v.getUint16(6, true), height: v.getUint16(8, true) };

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1]!;
      // SOF0-SOF15 carry the frame size; DHT/JPG/DAC in that range do not.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
        return { format: "JPEG", width: v.getUint16(i + 7), height: v.getUint16(i + 5) };
      i += 2 + v.getUint16(i + 2);
    }
  }
  return null;
}

/*
 * Google's stand-ins are static assets: the same volume-independent file comes
 * back byte for byte across unrelated books, which makes an exact fingerprint
 * the one signal that separates the grey "no cover" board from a real cover of
 * almost identical shape. Measured at zoom 3 (and zoom 2, which is no safer):
 *
 *   575x750  9103 B   PNG   "image not available", 14 books
 *   575x829  246264 B JPEG  grey placeholder board, 3 books
 *   300x391  15567 B  PNG   the zoom-2 form of the first, 18 books
 */
const FINGERPRINTS = new Set(["575x750:9103", "575x829:246264", "300x391:15567"]);

/**
 * Is this stand-in rather than cover art?
 *
 * Biased towards rejecting: a false positive costs a sharper image that then
 * degrades to the small-but-real zoom 1, while a false negative puts "image
 * not available" on the shelf. That is why the flat-PNG rule is here at all.
 */
export function isPlaceholderCover(info: ImageInfo | null, byteLength: number): boolean {
  if (!info || info.width === 0 || info.height === 0) return true;

  // The wide strip: ~6:1 where every real cover is portrait.
  if (info.width > info.height * 1.5) return true;

  if (FINGERPRINTS.has(`${info.width}x${info.height}:${byteLength}`)) return true;

  // Flat vector-ish graphics compress far below photographic cover art. The
  // real PNG covers measured start at 0.059 bytes/pixel; the stand-ins run
  // 0.006-0.032. Only applied to PNG — real JPEG covers can be this small.
  if (info.format === "PNG" && byteLength / (info.width * info.height) < 0.04) return true;

  return false;
}
