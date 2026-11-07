import { expect, it } from "vitest";
import { translations } from "../content";
import { toMapPoint, villageMapScene } from "./village-map";

it("keeps the directions the player sees on the village screen", () => {
  const origin = toMapPoint({ x: 0, z: 0 });
  const screenRight = toMapPoint({ x: 1, z: -1 });
  const towardCamera = toMapPoint({ x: 1, z: 1 });
  expect(screenRight.x).toBeGreaterThan(origin.x);
  expect(screenRight.y).toBeCloseTo(origin.y);
  expect(towardCamera.y).toBeGreaterThan(origin.y);
  expect(towardCamera.x).toBeCloseTo(origin.x);
});

it("names every zone drawn on the map in both languages", () => {
  for (const lang of ["ko", "en"] as const) {
    const names = translations(lang).ui.map.zones as Record<string, string>;
    for (const zone of villageMapScene().zones) expect(names[zone.id], `${lang} ${zone.id}`).toBeTruthy();
  }
});

it("frames every labelled place inside the picture", () => {
  const scene = villageMapScene();
  const [left, top, width, height] = scene.viewBox.split(" ").map(Number) as [number, number, number, number];
  for (const zone of scene.zones) {
    expect(zone.x).toBeGreaterThan(left);
    expect(zone.x).toBeLessThan(left + width);
    expect(zone.y).toBeGreaterThan(top);
    expect(zone.y).toBeLessThan(top + height);
  }
});
