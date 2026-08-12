import { useState } from "react";
import type { WateringEvent } from "@hort/contracts";

/**
 * PROTOTYPE ONLY — delete with the switcher once one variant wins.
 *
 * Settled in earlier rounds: scoping keys on the numeric zone (never the
 * label), because filtering on labels split a renamed zone into two unrelated
 * options. That holds in every variant below.
 *
 * Open question, round three: as a dropdown, where does it go and how big is it?
 *
 *   A  Hairline text select in the card title row — smallest, no box
 *   B  Boxed select in the header, paired with the year stepper
 *   C  Full-width scope band under the header, with a hero total
 *   T  The tag row from round two, kept as the baseline to flip against
 *
 * A dropdown can only show one total at a time, so each variant has to answer
 * what happens to the other four. A drops them, B drops them, C trades them for
 * one large number for the current scope.
 *
 * Rendered on the existing dashboard route via `?variant=A|B|C|T`.
 */

export const zoneFilterVariants: Record<string, string> = {
  A: "Hairline select in the title row",
  B: "Boxed select paired with the year",
  C: "Full-width scope band, hero total",
  T: "Baseline: tag row in the title",
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

export const totalLitres = (stats: ZoneStat[]) => stats.reduce((sum, stat) => sum + stat.litres, 0);
const scopedLitres = (stats: ZoneStat[], active: number) =>
  (active === ALL_ZONES ? totalLitres(stats) : stats.find((stat) => stat.zone === active)?.litres ?? 0);

/** PROTOTYPE: `?variant=A|B|C|T`, reload-stable and shareable. */
export function useZoneFilterVariant(): [string, (next: string) => void] {
  const [variant, setVariant] = useState(() => (typeof window === "undefined" ? "A" : new URLSearchParams(window.location.search).get("variant") ?? "A"));
  return [zoneFilterVariants[variant] ? variant : "A", (next: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.history.replaceState({}, "", url);
    setVariant(next);
  }];
}

type SelectProps = { stats: ZoneStat[]; active: number; onChange(zone: number): void };

/**
 * The bare control, shared by every dropdown variant. `appearance: none` in CSS
 * strips the rounded gray OS chrome; each variant draws its own caret. Options
 * carry totals so the comparison survives inside the open menu.
 */
function ZoneSelect({ stats, active, onChange, withTotals = true }: SelectProps & { withTotals?: boolean }) {
  const total = totalLitres(stats);
  const suffix = (litres: number) => (withTotals ? ` — ${litres.toFixed(0)} L` : "");
  return <select aria-label="Scope history to a zone" value={active} onChange={(event) => onChange(Number(event.target.value))}>
    <option value={ALL_ZONES}>All zones{suffix(total)}</option>
    {stats.map((stat) => <option key={stat.zone} value={stat.zone}>{stat.label}{suffix(stat.litres)}</option>)}
  </select>;
}

// ---------------------------------------------------------------------------
// A — hairline text select in the card title row
// ---------------------------------------------------------------------------

/**
 * The smallest the control can get: no box, an underline and a caret, sized to
 * the title's own type. Costs no vertical space and reads as a caption on the
 * card rather than a control in it.
 */
export function ZoneSelectInline(props: SelectProps) {
  return <span className="proto-select proto-select-inline"><ZoneSelect {...props} withTotals={false}/></span>;
}

// ---------------------------------------------------------------------------
// B — boxed select in the header, paired with the year stepper
// ---------------------------------------------------------------------------

/**
 * Deliberately matches the year stepper's height, border and kicker, so the two
 * read as one pair answering "what am I looking at" — a year and a zone.
 */
export function ZoneSelectBoxed(props: SelectProps) {
  return <div className="proto-scope-heading">
    <span className="watering-kicker">Zone scope</span>
    <div className="proto-select proto-select-boxed"><ZoneSelect {...props}/></div>
  </div>;
}

// ---------------------------------------------------------------------------
// C — full-width scope band under the header, with a hero total
// ---------------------------------------------------------------------------

/**
 * The largest option. A dropdown cannot show four totals at once, so this trades
 * them for one big number: the litres delivered by whatever is currently scoped.
 * The size buys back the quantitative reading the tag row gave for free.
 */
export function ZoneSelectBand({ stats, active, onChange }: SelectProps) {
  return <div className="proto-band">
    <div className="proto-band-control">
      <span className="watering-kicker">Showing</span>
      <div className="proto-select proto-select-band"><ZoneSelect stats={stats} active={active} onChange={onChange} withTotals={false}/></div>
    </div>
    <div className="proto-band-total">
      <span className="watering-kicker">This year</span>
      <strong>{scopedLitres(stats, active).toFixed(0)} <small>L</small></strong>
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
// T — baseline: the round-two tag row
// ---------------------------------------------------------------------------

/**
 * Kept so the dropdowns can be judged against the thing they replace. Every
 * known zone is rendered whether or not it was watered, so the row never
 * reflows between years and all five totals stay readable without a click.
 */
export function ZoneTags({ stats, active, onChange }: SelectProps) {
  return <div className="proto-tags" role="group" aria-label="Scope history to a zone">
    <button type="button" aria-pressed={active === ALL_ZONES} onClick={() => onChange(ALL_ZONES)}>
      All zones<small>{totalLitres(stats).toFixed(0)} L</small>
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
