// Shared wire types between the Express server and the browser. Pure types plus
// the entity-kind map needed to parse device topics. No runtime dependencies and
// no presentation metadata (labels/units/decimals live client-side).

export type Severity = "normal" | "danger";
export type EntityValue = { value: number | string; known: boolean };
/** `time` is an ISO string on the wire; the client parses it to a Date for display. */
export type LogEntry = { message: string; severity: Severity; time: string };
/** The upstream valves. Exactly one is open at a time; which is which is fixed in firmware. */
export type SourceId = "clean_water_valve" | "fertigation_valve" | "microbiology_valve";
export const sourceIds: SourceId[] = ["clean_water_valve", "fertigation_valve", "microbiology_valve"];
/** Downstream zone valves. Exactly one is open at a time; 0 means none. */
export const zoneNumbers = [1, 2, 3, 4] as const;
export type ZoneNumber = (typeof zoneNumbers)[number];

export type Snapshot = {
  deviceOnline: boolean;
  brokerConnected: boolean;
  entities: Record<string, EntityValue>;
  valves: Record<SourceId, boolean>;
  /** The open zone, or 0 when every zone valve is shut. */
  selectedZone: number;
  /** Operator-authored zone names, current values (see web ADR-0010). */
  zoneNames: Record<number, string>;
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
  zone_1: "switch", zone_2: "switch", zone_3: "switch", zone_4: "switch",
};

export type ResetResult =
  | "success"
  | "already_zero"
  | "rejected_pump_running"
  | "rejected_flow_active"
  | "rejected_flow_unknown"
  | "error_persistence";

// A completed watering event, reported by the controller (the authoritative
// source) and ingested by the server. `deviceId`+`seq` is the device-scoped
// identity/dedup key. `startedAt`/`endedAt` are ISO strings, or null when the
// controller had no valid clock (no RTC and no network) at capture time.
export type WateringOutcome = "completed" | "aborted" | "dry_run" | "recovery";
export type WateringTrigger = "manual" | "sequence";
export type WateringEvent = {
  id: number;
  deviceId: string;
  seq: number;
  startedAt: string | null;
  endedAt: string | null;
  litresDelivered: number;
  outcome: WateringOutcome;
  trigger: WateringTrigger;
  /** Zone watered, or null when the controller recorded none (device sends 0). */
  zone: number | null;
  /** The zone's name when this event ran, not its name now (web ADR-0010). */
  zoneName: string | null;
};

/** One consistent read of an event range plus global watering-history metadata. */
export type WateringHistory = {
  chartEvents: WateringEvent[];
  lastWatering: WateringEvent | null;
  earliestEventAt: string | null;
};

// Command names (URL segment under POST /api/commands/<name>) and their request bodies.
/** "" closes every source. */
export type ValveSelection = "" | SourceId;
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
  /** 0 shuts every zone. */
  "select-zone": { zone: number };
  "set-zone-name": { zone: number; name: string };
};
export type CommandName = keyof CommandBodies;
