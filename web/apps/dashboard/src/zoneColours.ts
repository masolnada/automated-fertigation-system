import { useSyncExternalStore } from "react";
import { zoneColours, type ZoneColour } from "@hort/ui";

/**
 * Zone colours are a disposable, browser-local aid (web ADR-0019). The operator
 * picks one per Zone from the Zones list; the choice lives only here, keyed by
 * zone id, exactly as the theme lives in localStorage (web ADR-0013). Colours may
 * repeat, are never sent to the server, and an archived Zone has none.
 */
const STORAGE_KEY = "hort-zone-colours";
type ColourMap = Record<string, ZoneColour>;

const validColours = new Set<string>(zoneColours);

function load(): ColourMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([zoneId, colour]) => zoneId.length > 0 && typeof colour === "string" && validColours.has(colour)),
    ) as ColourMap;
  } catch { /* private mode or bad JSON: start empty */ }
  return {};
}

let colours: ColourMap = load();
const listeners = new Set<() => void>();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(colours)); } catch { /* private mode: this session only */ }
}

/** Set a Zone's colour, or clear it (null) — e.g. when archiving. */
export function setZoneColour(zoneId: string, colour: ZoneColour | null): void {
  if ((colour === null && !(zoneId in colours)) || colours[zoneId] === colour) return;
  const next = { ...colours };
  if (colour === null) delete next[zoneId];
  else next[zoneId] = colour;
  colours = next;
  persist();
  for (const listener of listeners) listener();
}

/** An archived Zone loses its colour outright (web ADR-0019). */
export const forgetZoneColour = (zoneId: string): void => setZoneColour(zoneId, null);

/** Purge colors for Zones archived elsewhere before this browser saw the act. */
export function forgetArchivedZoneColours(zones: Array<{ id: string; archived: boolean }>): void {
  const archived = new Set(zones.filter((zone) => zone.archived).map((zone) => zone.id));
  if (![...archived].some((id) => id in colours)) return;
  colours = Object.fromEntries(Object.entries(colours).filter(([id]) => !archived.has(id)));
  persist();
  for (const listener of listeners) listener();
}

/** Test seam: clear every pick, in both the cache and storage. */
export function resetZoneColours(): void {
  colours = {};
  persist();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current zone-id → colour map, re-rendering on any pick. */
export function useZoneColours(): ColourMap {
  return useSyncExternalStore(subscribe, () => colours, () => colours);
}

/**
 * Resolve a Zone's colour for rendering: none while archived, so an archived
 * Zone always reads gray regardless of any stale entry.
 */
export function useColourOf(): (zone: { id: string; archived: boolean }) => ZoneColour | undefined {
  const map = useZoneColours();
  return (zone) => (zone.archived ? undefined : map[zone.id]);
}
