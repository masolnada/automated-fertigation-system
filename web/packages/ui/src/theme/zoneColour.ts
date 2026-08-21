import type { CSSProperties } from "react";

/**
 * The palette keys a Zone colour is picked from. A browser-local presentational
 * aid only — never persisted server-side and freely repeatable (web ADR-0019).
 */
export const zoneColours = ["terracotta", "ochre", "olive", "teal", "petrol", "indigo", "purple", "magenta"] as const;
export type ZoneColour = (typeof zoneColours)[number];

type ZoneColourDefinition = {
  label: string;
  fillLight: string;
  strokeLight: string;
  fillDark: string;
  strokeDark: string;
};

/**
 * Render values for the stable palette keys stored on Zones (web ADR-0018).
 * Keys are durable identity; these values are presentation and may evolve.
 */
const definitions: Record<ZoneColour, ZoneColourDefinition> = {
  terracotta: {
    label: "Terracotta",
    fillLight: "hsl(18 45% 74%)",
    strokeLight: "hsl(18 62% 38%)",
    fillDark: "hsl(18 35% 30%)",
    strokeDark: "hsl(18 60% 66%)",
  },
  ochre: {
    label: "Ochre",
    fillLight: "hsl(32 40% 69%)",
    strokeLight: "hsl(32 55% 32%)",
    fillDark: "hsl(32 32% 27%)",
    strokeDark: "hsl(32 46% 60%)",
  },
  olive: {
    label: "Olive",
    fillLight: "hsl(70 34% 66%)",
    strokeLight: "hsl(70 48% 28%)",
    fillDark: "hsl(70 30% 25%)",
    strokeDark: "hsl(70 40% 57%)",
  },
  teal: {
    label: "Teal",
    fillLight: "hsl(175 34% 66%)",
    strokeLight: "hsl(175 55% 26%)",
    fillDark: "hsl(175 34% 24%)",
    strokeDark: "hsl(175 44% 56%)",
  },
  petrol: {
    label: "Petrol",
    fillLight: "hsl(205 24% 72%)",
    strokeLight: "hsl(205 58% 32%)",
    fillDark: "hsl(205 30% 28%)",
    strokeDark: "hsl(205 50% 66%)",
  },
  indigo: {
    label: "Indigo",
    fillLight: "hsl(252 50% 80%)",
    strokeLight: "hsl(252 55% 43%)",
    fillDark: "hsl(252 32% 30%)",
    strokeDark: "hsl(252 58% 72%)",
  },
  purple: {
    label: "Purple",
    fillLight: "hsl(288 46% 80%)",
    strokeLight: "hsl(288 52% 40%)",
    fillDark: "hsl(288 30% 29%)",
    strokeDark: "hsl(288 55% 70%)",
  },
  magenta: {
    label: "Magenta",
    fillLight: "hsl(322 50% 79%)",
    strokeLight: "hsl(322 58% 39%)",
    fillDark: "hsl(322 32% 28%)",
    strokeDark: "hsl(322 60% 69%)",
  },
};

export const zoneColourPalette = zoneColours.map((key) => ({ key, ...definitions[key] }));
export const zoneColourLabel = (colour: ZoneColour): string => definitions[colour].label;

/** Pair with the `zone-tint` class so the active substrate selects its values. */
export function zoneTintStyle(colour: ZoneColour): CSSProperties {
  const definition = definitions[colour];
  return {
    "--zone-fill-light": definition.fillLight,
    "--zone-stroke-light": definition.strokeLight,
    "--zone-fill-dark": definition.fillDark,
    "--zone-stroke-dark": definition.strokeDark,
  } as CSSProperties;
}
