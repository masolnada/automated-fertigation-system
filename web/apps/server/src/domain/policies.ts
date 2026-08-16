import type { Frequency, ScheduleEntry, Snapshot } from "@hort/contracts";

const entity = (snapshot: Snapshot, id: string) => snapshot.entities[id];

/** Reset eligibility — the enforcing authority. Returns "" when a reset may proceed. */
export function resetIneligibleReason(snapshot: Snapshot): string {
  if (!snapshot.brokerConnected || !snapshot.deviceOnline) return "Device or broker offline";
  const pump = entity(snapshot, "pump"), flow = entity(snapshot, "flow_rate"), total = entity(snapshot, "total_water");
  if (!pump?.known || !flow?.known || !total?.known) return "Waiting for state";
  if (pump.value === "ON") return "Pump running";
  const flowValue = Number(flow.value); if (!Number.isFinite(flowValue)) return "Flow unknown";
  if (flowValue >= 0.1) return "Flow active";
  const totalValue = Number(total.value); if (!Number.isFinite(totalValue)) return "Total unknown";
  if (totalValue <= 0) return "Already zero";
  if (snapshot.resetPending) return "Waiting for device";
  return "";
}
export const canReset = (snapshot: Snapshot) => resetIneligibleReason(snapshot) === "";

/**
 * Assignment eligibility — the enforcing authority (web ADR-0014). Reassigning
 * a channel while the pump runs would split one pump-on span across two zones,
 * which the temporal resolution cannot express. A blocked precondition, not a
 * failure: the operator clears it by stopping the pump.
 */
export function assignIneligibleReason(snapshot: Snapshot): string {
  const pump = entity(snapshot, "pump");
  return pump?.known && pump.value === "ON" ? "Stop the pump to edit assignments" : "";
}

// --------------------------------------------------------------- scheduling

/** 1970-01-01 was a Thursday (ISO weekday 4), which fixes the phase. */
const isoWeekday = (dayNumber: number): number => ((dayNumber + 3) % 7) + 1;
export const dayNumberOf = (isoDate: string): number => Math.floor(new Date(`${isoDate}T00:00:00Z`).getTime() / 86_400_000);

/** Does this frequency fire on that day? Pure calendar arithmetic, as on the device. */
export function firesOn(frequency: Frequency, dayNumber: number): boolean {
  if (frequency.kind === "weekdays") return frequency.days.includes(isoWeekday(dayNumber));
  return dayNumber >= dayNumberOf(frequency.from) && (dayNumber - dayNumberOf(frequency.from)) % frequency.n === 0;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const periodOf = (frequency: Frequency) => (frequency.kind === "weekdays" ? 7 : frequency.n);
const anchorOf = (frequency: Frequency) => (frequency.kind === "weekdays" ? 0 : dayNumberOf(frequency.from));

/**
 * Will these two frequencies ever fire on the same day?
 *
 * Both are periodic, so the answer repeats every `lcm` of their periods, and
 * simulating exactly one such window from the later anchor is complete rather
 * than a sample. Bounded by lcm(89, 90) = 8010 days, so it is cheap enough to
 * do the obvious thing instead of the number theory.
 */
export function frequenciesShareADay(a: Frequency, b: Frequency): boolean {
  const start = Math.max(anchorOf(a), anchorOf(b));
  const period = (periodOf(a) * periodOf(b)) / gcd(periodOf(a), periodOf(b));
  for (let day = start; day < start + period; day++) if (firesOn(a, day) && firesOn(b, day)) return true;
  return false;
}

/**
 * Whether a new entry may be created — the enforcing authority. Returns "" when
 * the slot is free.
 *
 * The controller has one pump and `irrigation_sequence` is `mode: single`, so a
 * time slot belongs to the *machine*, not to a zone: two entries at 06:00 on
 * different channels collide exactly as two on the same channel would. The
 * second is dropped as a Skipped run (controller ADR-0018), which is the safety
 * net; refusing to create it is the fix.
 *
 * Deliberately *not* a run-overlap check. A run's length is only knowable in
 * Time mode — in Volume mode it depends on the flow rate the pump happens to
 * achieve, so 200 L might take twenty minutes or all morning. A guard that
 * refused 06:00 and 06:20 for a Time entry but allowed it for a Volume one would
 * be less predictable than no guard at all, so this refuses only certain
 * collisions and leaves near-misses to the Skipped run to report.
 */
export function scheduleCollisionReason(existing: ScheduleEntry[], candidate: { time: string; frequency: Frequency }): string {
  const clash = existing.find((entry) => entry.time === candidate.time && frequenciesShareADay(entry.frequency, candidate.frequency));
  return clash ? `${candidate.time} is already taken by the schedule on output ${clash.channel}` : "";
}

/** Numeric ranges (moved off the browser's HTML min/max). */
export const ranges = {
  cycle_minutes: { min: 0, max: 180 },
  cycle_liters: { min: 0, max: 500 },
  "pre-wet_percent": { min: 0, max: 100 },
  flush_minutes: { min: 1, max: 60 },
  min_flow: { min: 0, max: 10 },
} as const;
export type RangeId = keyof typeof ranges;

export function inRange(id: RangeId, value: number): boolean {
  const range = ranges[id];
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}
