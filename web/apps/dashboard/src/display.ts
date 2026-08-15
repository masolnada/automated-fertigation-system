// Presentation metadata for entities (labels, decimals, units) plus number
// formatting. Moved client-side from the deleted @hort/mqtt package — the server
// domain keeps only entity kinds.
import type { StateKind, Severity } from "@hort/contracts";

export type Entity = { kind: StateKind; decimals: number; label: string; unit: string };
export const entities: Record<string, Entity> = {
  battery_voltage: { kind: "sensor", decimals: 2, label: "Voltage", unit: "V" }, battery_current: { kind: "sensor", decimals: 2, label: "Current", unit: "A" }, battery_state_of_charge: { kind: "sensor", decimals: 1, label: "State of charge", unit: "%" }, battery_consumed_ah: { kind: "sensor", decimals: 1, label: "Consumed", unit: "Ah" }, battery_time_remaining: { kind: "sensor", decimals: 0, label: "Time remaining", unit: "min" },
  flow_rate: { kind: "sensor", decimals: 1, label: "Flow rate", unit: "L/min" }, total_water: { kind: "sensor", decimals: 1, label: "Total water", unit: "L" }, cycle_minutes: { kind: "number", decimals: 0, label: "Cycle minutes", unit: "min" }, cycle_liters: { kind: "number", decimals: 1, label: "Cycle liters", unit: "L" }, "pre-wet_percent": { kind: "number", decimals: 0, label: "Pre-wet percent", unit: "%" }, flush_minutes: { kind: "number", decimals: 0, label: "Flush minutes", unit: "min" }, min_flow: { kind: "number", decimals: 1, label: "Min flow", unit: "L/min" }, cycle_mode: { kind: "select", decimals: 0, label: "Cycle mode", unit: "" },
};
export function decimalPlaces(id: string) { return entities[id]?.decimals ?? 1; }
/** An output channel with no zone assigned is shown as the bare channel (web ADR-0014). */
export const channelLabel = (channel: number) => `Output ${channel}`;
export function displayNumber(value: unknown, id: string) { const n = typeof value === "number" ? value : Number.parseFloat(String(value)); return Number.isFinite(n) ? n.toFixed(decimalPlaces(id)) : "–"; }

/** Reset outcomes → dialog copy (mirrors the server's log wording). */
export const resetMessages: Record<string, [string, Severity]> = {
  success: ["total water reset", "normal"], already_zero: ["total water already zero", "normal"],
  rejected_pump_running: ["Device rejected reset: pump is running.", "danger"], rejected_flow_active: ["Device rejected reset: flow is active.", "danger"], rejected_flow_unknown: ["Device rejected reset: flow is unavailable.", "danger"],
  error_persistence: ["Device could not persist zero. The reset may not survive reboot.", "danger"],
  timeout: ["No response from device. Check its connection and current total before retrying.", "danger"],
};
