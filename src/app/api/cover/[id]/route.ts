import { imageInfo, isPlaceholderCover } from "@/lib/cover-check";

/*
 * Serves the sharpest cover a Google volume actually has.
 *
 * The browser cannot make this call itself: Google returns its stand-in
 * graphics with a 200 and a plausible portrait shape, and the one signal that
 * gives them away — the byte count — is invisible to an <img>. So the check
 * happens here and the client is handed the winner, already decided.
 *
 * ponytail: the verdict is memoised per process, which is enough for a
 * personal shelf. Move it to a column on `book` if this ever runs at a size
 * where a cold start per region is worth avoiding.
 */
const HIGH = 3; // 575px — covers the 208px detail hero on a 2x screen
const LOW = 1; // 128px — the only zoom every volume answers for real

const verdicts = new Map<string, number>();

const contentUrl = (id: string, zoom: number) =>
  `https://books.google.com/books/content?id=${encodeURIComponent(id)}` +
  `&printsec=frontcover&img=1&zoom=${zoom}`;

async function load(id: string, zoom: number) {
  const upstream = await fetch(contentUrl(id, zoom));
  if (!upstream.ok) return null;
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  return {
    bytes,
    type: upstream.headers.get("content-type") ?? "image/jpeg",
    placeholder: isPlaceholderCover(imageInfo(bytes), bytes.byteLength),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const known = verdicts.get(id);
  let image = await load(id, known ?? HIGH);

  // Only the high zoom can be a stand-in; the low one is what Google always has.
  if (known === undefined && (!image || image.placeholder)) {
    verdicts.set(id, LOW);
    image = await load(id, LOW);
  } else if (known === undefined && image) {
    verdicts.set(id, HIGH);
  }

  if (!image) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.type,
      // Which zoom a volume has is a fact about Google's scan, not about us.
      "Cache-Control": "public, max-age=2592000, stale-while-revalidate=86400",
    },
  });
}
