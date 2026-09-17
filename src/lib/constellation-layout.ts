import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { buildGenreGraph, type ReadingMap } from "@/lib/constellation";
import { getConstellationBooks } from "@/lib/queries";

/*
 * Server-only: the layout is computed once per request so d3 never ships to
 * the browser. d3-force seeds its own random source, so nodes inserted in a
 * stable (id) order give the same picture every time.
 */

const WIDTH = 1000;
const HEIGHT = 720;
const PADDING = 48;
const TICKS = 400;
const BOOK_RADIUS = 4.5;
/*
 * The full map draws books as 26×39 covers, so the simulation spaces them as
 * if they were that big while `r` stays the dot's radius. Tuned against the
 * real shelves: covers rarely overlap and genres keep their room.
 */
const BOOK_COLLIDE_RADIUS = 20;
const BOOK_LINK_DISTANCE = 46;

type SimNode = SimulationNodeDatum & { id: string; kind: "genre" | "book"; r: number };
type SimLink = SimulationLinkDatum<SimNode> & { kind: "parent" | "book" };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function layoutReadingMap(graph: Omit<ReadingMap, "width" | "height">): ReadingMap {
  const genres = graph.genres.map((g) => ({
    ...g,
    r: 10 + 4 * Math.sqrt(g.bookCount) + (g.depth === 0 ? 4 : 0),
  }));
  const books = graph.books.map((b) => ({ ...b, r: BOOK_RADIUS }));

  // Fresh objects without x/y: d3 only seeds its phyllotaxis start for NaN positions.
  const nodes: SimNode[] = [...genres, ...books].map((n) => ({ id: n.id, kind: n.kind, r: n.r }));
  const links: SimLink[] = graph.links.map((l) => ({ source: l.source, target: l.target, kind: l.kind }));

  forceSimulation(nodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance((l) => (l.kind === "book" ? BOOK_LINK_DISTANCE : 90))
        .strength((l) => (l.kind === "book" ? 0.9 : 0.4))
    )
    .force("charge", forceManyBody<SimNode>().strength((d) => (d.kind === "genre" ? -380 : -28)))
    .force(
      "collide",
      forceCollide<SimNode>((d) => (d.kind === "genre" ? d.r + 18 : BOOK_COLLIDE_RADIUS))
    )
    .force("x", forceX<SimNode>(0).strength(0.06))
    .force("y", forceY<SimNode>(0).strength(0.06))
    .stop()
    .tick(TICKS);

  // Uniform scale into the padded viewBox, centred.
  const xs = nodes.map((n) => n.x ?? 0);
  const ys = nodes.map((n) => n.y ?? 0);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const innerW = WIDTH - 2 * PADDING;
  const innerH = HEIGHT - 2 * PADDING;
  const scale = Math.min(spanX > 0 ? innerW / spanX : 1, spanY > 0 ? innerH / spanY : 1);
  const offsetX = PADDING + (innerW - spanX * scale) / 2;
  const offsetY = PADDING + (innerH - spanY * scale) / 2;

  const pos = new Map(
    nodes.map((n) => [
      n.id,
      { x: round1(offsetX + ((n.x ?? 0) - minX) * scale), y: round1(offsetY + ((n.y ?? 0) - minY) * scale) },
    ])
  );
  const place = <T extends { id: string }>(n: T): T => ({ ...n, ...pos.get(n.id)! });

  return {
    width: WIDTH,
    height: HEIGHT,
    genres: genres.map(place),
    books: books.map(place),
    links: graph.links,
    topGenreIds: graph.topGenreIds,
  };
}

/** Query → graph → layout. Null when too few books have usable subjects. */
export async function getReadingMap(userId: string): Promise<ReadingMap | null> {
  const graph = buildGenreGraph(await getConstellationBooks(userId));
  return graph ? layoutReadingMap(graph) : null;
}
