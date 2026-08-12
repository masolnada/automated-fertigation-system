import { useState } from "react";
import type { WateringEvent } from "@hort/contracts";

/**
 * PROTOTYPE ONLY — delete with the switcher once one variant wins.
 *
 * Question: what should scoping the watering history to a zone look like, given
 * that zone names are temporal (web ADR-0010) and a rename must not fragment a
 * zone's history?
 *
 *   A  Segmented control keyed on zone identity, labelled with the current name
 *   B  No filter at all — one weekly strip per zone, stacked for comparison
 *   C  No chrome — drill down by clicking a zone in the Daily Inspector split
 *
 * All three filter on the numeric zone, never on the label, so a rename moves
 * the whole zone. Event rows keep their historical name, which ADR-0010 wants.
 *
 * Rendered on the existing dashboard route via `?variant=A|B|C`.
 */

export const zoneFilterVariants: Record<string, string> = {
  A: "Segmented control on zone identity",
  B: "Per-zone weekly strips, no filter",
  C: "Drill-down from the Daily Inspector",
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

// ---------------------------------------------------------------------------
// Variant A — segmented control keyed on zone identity
// ---------------------------------------------------------------------------

/**
 * Every known zone is always rendered, whether or not it was watered this year,
 * so the control never reflows between years and a zero year reads as a fact
 * rather than a missing button.
 */
export function ZoneSegments({ stats, active, onChange }: { stats: ZoneStat[]; active: number; onChange(zone: number): void }) {
  const current = stats.find((stat) => stat.zone === active);
  const total = stats.reduce((sum, stat) => sum + stat.litres, 0);
  return <div className="proto-a">
    <div className="proto-a-bar" role="group" aria-label="Scope history to a zone">
      <button type="button" aria-pressed={active === ALL_ZONES} onClick={() => onChange(ALL_ZONES)}>
        <span>All zones</span><small>{total.toFixed(0)} L</small>
      </button>
      {stats.map((stat) => <button key={stat.zone} type="button" aria-pressed={active === stat.zone} onClick={() => onChange(stat.zone)}>
        <span>{stat.label}</span><small>{stat.litres.toFixed(0)} L</small>
      </button>)}
    </div>
    {current?.aliases.length ? <p className="proto-a-alias">Earlier this year this zone was recorded as {current.aliases.join(", ")}. Renaming moves the whole zone; event rows keep the name they ran under.</p> : null}
  </div>;
}

// ---------------------------------------------------------------------------
// Variant B — per-zone weekly strips, no filter at all
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const mondayIndex = (key: string) => { const [y, m, d] = key.split("-").map(Number); return (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7; };
const madridKey = (date: Date) => {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
/** Weekly bands, roughly the daily heatmap bands times three-and-a-half. */
const weekLevel = (litres: number) => (!(litres > 0) ? 0 : litres <= 150 ? 1 : litres <= 350 ? 2 : litres <= 700 ? 3 : litres <= 1500 ? 4 : 5);

/**
 * Replaces the single all-zone heatmap with one row per zone, aggregated to
 * weeks so a full year fits without a filter. Comparison replaces scoping: the
 * operator sees which zone drank what, side by side, in one glance.
 */
export function ZoneStrips({ year, stats, events, todayKey, selectedZone, selectedKey, disabled, onSelect }: { year: number; stats: ZoneStat[]; events: WateringEvent[]; todayKey: string; selectedZone: number; selectedKey: string; disabled: boolean; onSelect(zone: number, key: string): void }) {
  const leading = mondayIndex(dateKey(year, 1, 1));
  const dayCount = daysInMonth(year, 2) === 29 ? 366 : 365;
  const weekCount = Math.ceil((leading + dayCount) / 7);
  const columns = `repeat(${weekCount}, minmax(0, 1fr))`;

  // week index -> { litres, issues, best day } per zone.
  const buckets = new Map<string, { litres: number; issues: number; bestKey: string; bestLitres: number }>();
  for (const event of events) {
    if (!event.endedAt || event.zone === null) continue;
    const key = madridKey(new Date(event.endedAt));
    if (!key.startsWith(String(year))) continue;
    const [, month, day] = key.split("-").map(Number);
    const ordinal = Math.round((Date.UTC(year, month! - 1, day!) - Date.UTC(year, 0, 1)) / 86_400_000);
    const bucketKey = `${event.zone}:${Math.floor((leading + ordinal) / 7)}`;
    const bucket = buckets.get(bucketKey) ?? { litres: 0, issues: 0, bestKey: key, bestLitres: -1 };
    bucket.litres += event.litresDelivered;
    if (event.outcome !== "completed") bucket.issues++;
    if (event.litresDelivered > bucket.bestLitres) { bucket.bestLitres = event.litresDelivered; bucket.bestKey = key; }
    buckets.set(bucketKey, bucket);
  }

  const monthPositions = MONTHS.map((label, index) => ({
    label,
    column: Math.floor((leading + Math.round((Date.UTC(year, index, 1) - Date.UTC(year, 0, 1)) / 86_400_000)) / 7) + 1,
  }));
  const firstOfWeek = (week: number) => {
    const ordinal = week * 7 - leading;
    const date = new Date(Date.UTC(year, 0, 1 + Math.max(0, ordinal)));
    return dateKey(year, date.getUTCMonth() + 1, date.getUTCDate());
  };

  return <div className="proto-b">
    <p id="proto-b-scale" className="watering-visually-hidden">One row per zone. Each cell is one calendar week of water delivered by that zone, in five bands: up to 150, up to 350, up to 700, up to 1500, and more than 1500 litres. A red border means at least one event that week did not complete normally.</p>
    <div className="proto-b-months" style={{ gridTemplateColumns: columns }}>
      {monthPositions.map(({ label, column }) => <span key={label} style={{ gridColumn: `${column} / span 4` }}>{label}</span>)}
    </div>
    {stats.map((stat) => <div className={`proto-b-row${selectedZone === stat.zone ? " proto-b-row-active" : ""}`} key={stat.zone}>
      <button type="button" className="proto-b-label" aria-pressed={selectedZone === stat.zone} disabled={disabled} onClick={() => onSelect(selectedZone === stat.zone ? ALL_ZONES : stat.zone, selectedKey)}>
        <span>{stat.label}</span><small>{stat.litres.toFixed(0)} L</small>
      </button>
      <div className="proto-b-strip" role="row" aria-label={`${stat.label} weekly water in ${year}`} aria-describedby="proto-b-scale" style={{ gridTemplateColumns: columns }}>
        {Array.from({ length: weekCount }, (_, week) => {
          const bucket = buckets.get(`${stat.zone}:${week}`);
          const start = firstOfWeek(week);
          const litres = bucket?.litres ?? 0;
          const label = `${stat.label}, week of ${start}: ${litres.toFixed(1)} litres, ${bucket?.issues ?? 0} errors`;
          return <button type="button" key={week} disabled={disabled || start > todayKey} title={label} aria-label={label}
            onClick={() => onSelect(stat.zone, bucket?.bestKey ?? start)}
            className={`proto-b-cell watering-level-${weekLevel(litres)}${bucket?.issues ? " watering-cell-error" : ""}${bucket?.bestKey === selectedKey ? " watering-cell-selected" : ""}`}></button>;
        })}
      </div>
    </div>)}
  </div>;
}

// ---------------------------------------------------------------------------
// Variant C — no chrome; scope is a drill-down from the day's zone split
// ---------------------------------------------------------------------------

/**
 * Shown only while scoped. Unscoped, the card carries no filter chrome at all —
 * the operator discovers scoping by clicking a zone in the Daily Inspector.
 */
export function ZoneScopeBanner({ label, onClear }: { label: string; onClear(): void }) {
  return <div className="proto-c-banner" role="status">
    <span>Scoped to <strong>{label}</strong> — the year, month and day below count this zone only.</span>
    <button type="button" onClick={onClear}>Show all zones</button>
  </div>;
}
