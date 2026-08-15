import type { Snapshot } from "@hort/contracts";

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
