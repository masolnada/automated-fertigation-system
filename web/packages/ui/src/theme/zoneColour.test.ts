import { describe, expect, test } from "bun:test";
import { zoneColours, zoneColourLabel, zoneColourPalette, zoneTintStyle } from "./zoneColour";

describe("Zone colour palette", () => {
  test("has one named entry for every stable contract key", () => {
    expect(zoneColourPalette.map((entry) => entry.key)).toEqual([...zoneColours]);
    expect(zoneColourPalette.map((entry) => entry.label)).toEqual([
      "Terracotta", "Ochre", "Olive", "Teal", "Petrol", "Indigo", "Purple", "Magenta",
    ]);
  });

  test("keeps every Light and Dark fill and stroke distinct", () => {
    const styles = zoneColours.map((colour) => zoneTintStyle(colour) as Record<string, string>);
    for (const property of ["--zone-fill-light", "--zone-stroke-light", "--zone-fill-dark", "--zone-stroke-dark"]) {
      expect(new Set(styles.map((style) => style[property])).size).toBe(zoneColours.length);
    }
  });

  test("labels every stable key", () => {
    for (const colour of zoneColours) expect(zoneColourLabel(colour)).toBeTruthy();
  });
});
