import { useState } from "react";
import type { WateringEvent } from "@hort/contracts";

/**
 * PROTOTYPE ONLY — delete with the switcher once one variant wins.
 *
 * Settled in round one: scoping keys on the numeric zone (never the label), and
 * the control is a row of lightweight tags carrying each zone's year total.
 * Filtering on labels was the old bug — a rename split one zone into two
 * unrelated buttons.
 *
 * Open question, round two: where do the tags belong?
 *
 *   A  In the card title row, right-aligned — a card-level scope
 *   B  Directly under the heatmap, read as its legend
 *   C  A vertical rail beside the heatmap, read as row labels
 *
 * The tag treatment is identical in all three; only placement changes.
 *
 * Rendered on the existing dashboard route via `?variant=A|B|C`.
 */

export const zoneFilterVariants: Record<string, string> = {
  A: "Tags in the card title row",
  B: "Tags as a legend under the heatmap",
  C: "Tags as a vertical rail beside the heatmap",
};

/** 0 is every zone; -1 is the events the controller recorded no zone for. */
export const ALL_ZONES = 0;
export const NO_ZONE = -1;

export type ZoneStat = {
  /** Stable identity. The filter keys on this, never on the label. */
  zone: number;
  /** The zone's name right now, which is what a filter control should offer. */
  label: string;
  litres: number;
  events: number;
  /** Other names this zone's events ran under inside the loaded year. */
  aliases: string[];
};

export function matchesZone(event: WateringEvent, zone: number): boolean {
  if (zone === ALL_ZONES) return true;
  if (zone === NO_ZONE) return event.zone === null;
  return event.zone === zone;
}

/** PROTOTYPE: `?variant=A|B|C`, reload-stable and shareable. */
export function useZoneFilterVariant(): [string, (next: string) => void] {
  const [variant, setVariant] = useState(() => (typeof window === "undefined" ? "A" : new URLSearchParams(window.location.search).get("variant") ?? "A"));
  return [zoneFilterVariants[variant] ? variant : "A", (next: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.history.replaceState({}, "", url);
    setVariant(next);
  }];
}

/**
 * The settled treatment: one tag per zone plus All zones, each carrying its
 * total for the loaded year. Every known zone is always rendered, so the row
 * never reflows between years and a zero year reads as a fact rather than a
 * missing tag. `direction` only changes how the tags stack; the tag itself is
 * identical everywhere.
 */
export function ZoneTags({ stats, active, direction = "row", onChange }: { stats: ZoneStat[]; active: number; direction?: "row" | "column"; onChange(zone: number): void }) {
  const total = stats.reduce((sum, stat) => sum + stat.litres, 0);
  return <div className={`proto-tags proto-tags-${direction}`} role="group" aria-label="Scope history to a zone">
    <button type="button" aria-pressed={active === ALL_ZONES} onClick={() => onChange(ALL_ZONES)}>
      All zones<small>{total.toFixed(0)} L</small>
    </button>
    {stats.map((stat) => <button key={stat.zone} type="button" aria-pressed={active === stat.zone} onClick={() => onChange(stat.zone)}>
      {stat.label}<small>{stat.litres.toFixed(0)} L</small>
    </button>)}
  </div>;
}

/**
 * Shown only while scoped to a zone that ran under another name this year.
 * Keeps the rename legible without spending a line when nothing was renamed.
 */
export function ZoneAliasNote({ stats, active }: { stats: ZoneStat[]; active: number }) {
  const current = stats.find((stat) => stat.zone === active);
  if (!current?.aliases.length) return null;
  return <p className="proto-alias">Earlier this year this zone was recorded as {current.aliases.join(", ")}. Renaming moves the whole zone; event rows keep the name they ran under.</p>;
}
