import type { Frequency, ScheduleEntry } from "@hort/contracts";
import type { Snapshot } from "./store";
// Kept client-side for affordance only (dimming controls); the server is the enforcing authority.
const entity = (snapshot: Snapshot, id: string) => snapshot.entities[id];
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

/** Mirrors the server's assignment guard (web ADR-0014); dims the affordance only. */
export function assignIneligibleReason(snapshot: Snapshot): string {
  const pump = entity(snapshot, "pump");
  return pump?.known && pump.value === "ON" ? "Stop the pump to edit assignments" : "";
}

/**
 * Mirrors the server's slot guard (controller ADR-0018); dims the affordance
 * only. Duplicated rather than shared because the calendar arithmetic is domain
 * logic and contracts deliberately carries no behaviour (web ADR-0005).
 */
const isoWeekday = (dayNumber: number): number => ((dayNumber + 3) % 7) + 1;
const dayNumberOf = (isoDate: string): number => Math.floor(new Date(`${isoDate}T00:00:00Z`).getTime() / 86_400_000);
const firesOn = (frequency: Frequency, dayNumber: number): boolean =>
  frequency.kind === "weekdays"
    ? frequency.days.includes(isoWeekday(dayNumber))
    : dayNumber >= dayNumberOf(frequency.from) && (dayNumber - dayNumberOf(frequency.from)) % frequency.n === 0;
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export function frequenciesShareADay(a: Frequency, b: Frequency): boolean {
  const periodOf = (f: Frequency) => (f.kind === "weekdays" ? 7 : f.n);
  const anchorOf = (f: Frequency) => (f.kind === "weekdays" ? 0 : dayNumberOf(f.from));
  const start = Math.max(anchorOf(a), anchorOf(b));
  const period = (periodOf(a) * periodOf(b)) / gcd(periodOf(a), periodOf(b));
  for (let day = start; day < start + period; day++) if (firesOn(a, day) && firesOn(b, day)) return true;
  return false;
}

/** The zone already holding this slot, or "" when it is free. */
export function slotTakenBy(schedules: ScheduleEntry[], candidate: { time: string; frequency: Frequency }, nameOf: (channel: number) => string): string {
  const clash = schedules.find((entry) => entry.time === candidate.time && frequenciesShareADay(entry.frequency, candidate.frequency));
  return clash ? nameOf(clash.channel) : "";
}
