// Shared wire types between the Express server and the browser. Pure types plus
// the entity-kind map needed to parse device topics. No runtime dependencies and
// no presentation metadata (labels/units/decimals live client-side).

export type Severity = "normal" | "danger";
export type EntityValue = { value: number | string; known: boolean };
/** `time` is an ISO string on the wire; the client parses it to a Date for display. */
export type LogEntry = { message: string; severity: Severity; time: string };
export type Snapshot = {
  deviceOnline: boolean;
  brokerConnected: boolean;
  entities: Record<string, EntityValue>;
  valves: { clean_water_valve: boolean; fertigation_valve: boolean };
  resetPending: boolean;
  log: LogEntry[];
};

export type StateKind = "sensor" | "binary_sensor" | "switch" | "number" | "select";
/** Entity kinds only — needed to parse `${kind}/${objectId}/state` topics. */
export const entityKinds: Record<string, StateKind> = {
  battery_voltage: "sensor", battery_current: "sensor", battery_state_of_charge: "sensor", battery_consumed_ah: "sensor", battery_time_remaining: "sensor",
  flow_rate: "sensor", total_water: "sensor",
  cycle_minutes: "number", cycle_liters: "number", "pre-wet_percent": "number", flush_minutes: "number", min_flow: "number",
  cycle_mode: "select",
};

export type ResetResult =
  | "success"
  | "already_zero"
  | "rejected_pump_running"
  | "rejected_flow_active"
  | "rejected_flow_unknown"
  | "error_persistence";

// A watering event: one pump-on span (any trigger/stop), coalesced across the
// sequence's intra-handover pump-off gaps. `endedAt` is null while the event is
// open; `litresDelivered`/`peakFlow`/`avgFlow` are null until it is finalized.
// `startedAt`/`endedAt` are ISO strings on the wire.
export type WateringEvent = {
  id: number;
  startedAt: string;
  endedAt: string | null;
  litresDelivered: number | null;
  peakFlow: number | null;
  avgFlow: number | null;
};

// Command names (URL segment under POST /api/commands/<name>) and their request bodies.
export type ValveSelection = "" | "clean_water_valve" | "fertigation_valve";
export type CycleMode = "Time" | "Volume";

export type CommandBodies = {
  "start-irrigation": Record<string, never>;
  "stop-irrigation": Record<string, never>;
  "toggle-pump": Record<string, never>;
  "select-valve": { valve: ValveSelection };
  "set-cycle-mode": { mode: CycleMode };
  "set-pre-wet-percent": { value: number };
  "set-cycle-target": { value: number };
  "set-flush-duration": { value: number };
  "set-min-flow": { value: number };
  "reset-total-water": Record<string, never>;
};
export type CommandName = keyof CommandBodies;
