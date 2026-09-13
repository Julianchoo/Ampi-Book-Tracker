/**
 * Open Library client.
 *
 * Two quirks of this API drive the shape of this file, both confirmed against
 * the live service:
 *  - A works record can be a redirect stub pointing at the canonical work.
 *  - `description` is sometimes a bare string, sometimes `{ type, value }`.
 */

const SEARCH_FIELDS = [
  "key",
  "title",
  "author_name",
  "first_publish_year",
  "cover_i",
  "language",
  "number_of_pages_median",
  "subject",
].join(",");

/** A search hit, narrowed to what a result row and a shelf entry need. */
export type BookSearchResult = {
  olKey: string;
  title: string;
  author: string | null;
  coverId: number | null;
  firstPublishYear: number | null;
  pages: number | null;
  language: string | null;
  subjects: string[];
};

type RawDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  language?: string[];
  number_of_pages_median?: number;
  subject?: string[];
};

/**
 * Open Library subject lists are long and full of machine tags
 * ("nyt:trade-fiction-paperback=2021-11-07", "award:hugo_award=1966").
 * Keep only human-readable ones, title-cased, capped.
 */
export function cleanSubjects(subjects: string[] | undefined, max = 6): string[] {
  if (!subjects) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of subjects) {
    const s = raw.trim();
    // machine tags, over-long descriptive phrases, and accession noise
    if (!s || s.includes("=") || s.includes(":") || s.length > 28) continue;
    if (/\d{4}/.test(s)) continue;
    const label = s.charAt(0).toUpperCase() + s.slice(1);
    const dedupe = label.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(label);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * `language` lists every language the work has *an edition* in, in no useful
 * order — Dune's array starts "rum" (Romanian). Taking [0] would label most
 * books with whichever translation happens to sort first, so prefer English
 * when it is among them and otherwise take the first as a weak guess.
 */
function pickLanguage(languages: string[] | undefined): string | null {
  if (!languages?.length) return null;
  return languages.includes("eng") ? "eng" : (languages[0] ?? null);
}

function toResult(doc: RawDoc): BookSearchResult | null {
  if (!doc.key || !doc.title) return null;
  return {
    olKey: doc.key,
    title: doc.title,
    author: doc.author_name?.[0] ?? null,
    coverId: doc.cover_i ?? null,
    firstPublishYear: doc.first_publish_year ?? null,
    pages: doc.number_of_pages_median ?? null,
    language: pickLanguage(doc.language),
    subjects: cleanSubjects(doc.subject),
  };
}

/**
 * Search Open Library. Cached for an hour so repeated keystrokes and repeated
 * queries hit Next's data cache rather than the upstream service.
 */
export async function searchBooks(
  query: string,
  limit = 8
): Promise<BookSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const url =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}` +
    `&limit=${limit}&fields=${SEARCH_FIELDS}`;

  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: { "User-Agent": "BookTracker/1.0 (personal reading tracker)" },
  });
  if (!res.ok) throw new Error(`Open Library search failed: ${res.status}`);

  const data = (await res.json()) as { docs?: RawDoc[] };
  return (data.docs ?? []).map(toResult).filter((b): b is BookSearchResult => b !== null);
}

type RawWork = {
  key?: string;
  title?: string;
  description?: string | { value?: string };
  subjects?: string[];
  type?: { key?: string };
  location?: string;
};

export type WorkDetail = {
  description: string | null;
  subjects: string[];
};

/** Normalise the two shapes `description` arrives in. */
function readDescription(d: RawWork["description"]): string | null {
  if (!d) return null;
  const text = typeof d === "string" ? d : (d.value ?? "");
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function fetchWork(olKey: string): Promise<RawWork | null> {
  const path = olKey.startsWith("/") ? olKey : `/works/${olKey}`;
  const res = await fetch(`https://openlibrary.org${path}.json`, {
    next: { revalidate: 86400 },
    headers: { "User-Agent": "BookTracker/1.0 (personal reading tracker)" },
  });
  if (!res.ok) return null;
  return (await res.json()) as RawWork;
}

/**
 * Long-form detail for a work. Returns empty fields rather than throwing —
 * many works genuinely have no description, and a book page must still render.
 */
export async function getWorkDetail(olKey: string): Promise<WorkDetail> {
  try {
    let work = await fetchWork(olKey);

    // Follow a redirect stub once. Once is enough in practice, and a bounded
    // hop can't spin on a cycle.
    if (work?.type?.key === "/type/redirect" && work.location) {
      work = await fetchWork(work.location);
    }
    if (!work) return { description: null, subjects: [] };

    return {
      description: readDescription(work.description),
      subjects: cleanSubjects(work.subjects),
    };
  } catch {
    return { description: null, subjects: [] };
  }
}

/** "/works/OL893414W" -> "OL893414W", for building outbound links. */
export function olId(olKey: string): string {
  return olKey.replace(/^\/works\//, "");
}
