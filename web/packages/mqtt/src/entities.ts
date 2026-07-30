import type { StateKind } from "./topics";
export type Entity = { kind: StateKind; decimals: number; label: string; unit: string };
export const entities: Record<string, Entity> = {
  battery_voltage: { kind: "sensor", decimals: 2, label: "Voltage", unit: "V" }, battery_current: { kind: "sensor", decimals: 2, label: "Current", unit: "A" }, battery_state_of_charge: { kind: "sensor", decimals: 1, label: "State of charge", unit: "%" }, battery_consumed_ah: { kind: "sensor", decimals: 1, label: "Consumed", unit: "Ah" }, battery_time_remaining: { kind: "sensor", decimals: 0, label: "Time remaining", unit: "min" },
  "ds18b20-1": { kind: "sensor", decimals: 1, label: "Temperature", unit: "°C" }, flow_rate: { kind: "sensor", decimals: 1, label: "Flow rate", unit: "L/min" }, total_water: { kind: "sensor", decimals: 1, label: "Total water", unit: "L" },
};
export function decimalPlaces(id: string) { return entities[id]?.decimals ?? 1; }
export function displayNumber(value: unknown, id: string) { const n = typeof value === "number" ? value : Number.parseFloat(String(value)); return Number.isFinite(n) ? n.toFixed(decimalPlaces(id)) : "–"; }
