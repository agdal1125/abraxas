import village from "../../../content/world/village.json";
import type { Vec2 } from "../core/world/types";
import "./village-map.css";

type Prop = Vec2 & { asset: string };
type MapSource = {
  bounds: { outer: Vec2[]; holes: Vec2[][]; bridges: { points: Vec2[] }[] };
  zones: Record<string, Vec2>;
  paths: { width: number; points: Vec2[] }[];
  props: Prop[];
};

export type ZoneId = "plaza" | "bakery" | "library" | "smithy" | "lake" | "entrance" | "gate";
export type MapPoint = { x: number; y: number };
export type VillageMapScene = {
  viewBox: string;
  land: string;
  roads: { d: string; width: number }[];
  bridges: string[];
  buildings: MapPoint[];
  trees: MapPoint[];
  zones: (MapPoint & { id: ZoneId })[];
};
export type VillageMapMarkers = { player: Vec2; targets: Vec2[] };

const SVG_NS = "http://www.w3.org/2000/svg";
const ZONE_IDS: ZoneId[] = ["plaza", "bakery", "library", "smithy", "lake", "entrance", "gate"];
const BUILDINGS = new Set(["bakery", "library", "smithy", "entrance-house", "plaza-hall", "lake-pavilion", "festival-stage", "memory-gate"]);
// The village camera looks down at 35 degrees from the +x+z corner, so the map keeps the directions the player sees.
const FORESHORTEN = Math.sin(35 * Math.PI / 180);
const MARGIN = 1;
const LABEL_OFFSET = 1.5;

export function toMapPoint({ x, z }: Vec2): MapPoint {
  return { x: (x - z) / Math.SQRT2, y: (x + z) / Math.SQRT2 * FORESHORTEN };
}

const line = (points: Vec2[]) => points.map((point, index) => { const { x, y } = toMapPoint(point); return `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`; }).join("");
const ring = (points: Vec2[]) => `${line(points)}Z`;
const byDepth = (a: MapPoint, b: MapPoint) => a.y - b.y;

export function villageMapScene(map: MapSource = village as MapSource): VillageMapScene {
  const coast = map.bounds.outer.map(toMapPoint);
  const left = Math.min(...coast.map(point => point.x)) - MARGIN, top = Math.min(...coast.map(point => point.y)) - MARGIN;
  const width = Math.max(...coast.map(point => point.x)) + MARGIN - left, height = Math.max(...coast.map(point => point.y)) + MARGIN - top;
  const placed = (matches: (asset: string) => boolean) => map.props.filter(prop => matches(prop.asset)).map(toMapPoint).sort(byDepth);
  return {
    viewBox: `${left.toFixed(2)} ${top.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`,
    land: [map.bounds.outer, ...map.bounds.holes].map(ring).join(""),
    roads: map.paths.map(path => ({ d: line(path.points), width: path.width })),
    bridges: map.bounds.bridges.map(bridge => ring(bridge.points)),
    buildings: placed(asset => BUILDINGS.has(asset)),
    trees: placed(asset => asset.startsWith("tree-")),
    zones: ZONE_IDS.map(id => ({ id, ...toMapPoint(map.zones[id]!) })),
  };
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>, className?: string): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  if (className) element.setAttribute("class", className);
  return element;
}

const dot = ({ x, y }: MapPoint, radius: number, className: string) => svg("circle", { cx: x.toFixed(2), cy: y.toFixed(2), r: radius }, className);

export function renderVillageMap(markers: VillageMapMarkers, label: string, zoneNames: Record<ZoneId, string>): SVGSVGElement {
  const scene = villageMapScene();
  const root = svg("svg", { viewBox: scene.viewBox, role: "img", "aria-label": label }, "map-picture");
  root.append(svg("path", { d: scene.land, "fill-rule": "evenodd" }, "map-land"));
  for (const road of scene.roads) root.append(svg("path", { d: road.d, "stroke-width": road.width }, "map-road"));
  for (const d of scene.bridges) root.append(svg("path", { d }, "map-bridge"));
  for (const tree of scene.trees) root.append(dot(tree, .42, "map-tree"));
  for (const { x, y } of scene.buildings) root.append(svg("path", { d: `M${(x - .6).toFixed(2)} ${y.toFixed(2)}v-.55l.6-.5l.6.5v.55Z` }, "map-building"));
  for (const zone of scene.zones) {
    const name = svg("text", { x: zone.x.toFixed(2), y: (zone.y + LABEL_OFFSET).toFixed(2) }, "map-zone");
    name.textContent = zoneNames[zone.id];
    root.append(name);
  }
  for (const target of markers.targets) root.append(dot(toMapPoint(target), .55, "map-target"));
  root.append(dot(toMapPoint(markers.player), .6, "map-player"));
  return root;
}

export function mapLegend(here: string, target: string): HTMLElement {
  const legend = document.createElement("ul");
  legend.className = "map-legend";
  for (const [text, className] of [[here, "is-player"], [target, "is-target"]] as const) {
    const entry = document.createElement("li");
    entry.textContent = text;
    entry.className = className;
    legend.append(entry);
  }
  return legend;
}
