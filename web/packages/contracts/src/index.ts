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
/**
 * Downstream output channels. Exactly one is open at a time; 0 means none. A
 * channel is a numbered relay and nothing more — which place it waters is a
 * Zone, assigned server-side (web ADR-0014). Hardware-fixed at four by the relay
 * budget (controller ADR-0015).
 */
export const outputChannels = [1, 2, 3, 4] as const;
export type OutputChannel = (typeof outputChannels)[number];

/** A place that gets watered. Identified by `id`; `name` is a current label (web ADR-0015). */
export type Zone = { id: string; name: string; archived: boolean };

export type Snapshot = {
  deviceOnline: boolean;
  brokerConnected: boolean;
  entities: Record<string, EntityValue>;
  valves: Record<SourceId, boolean>;
  /** The open output channel, or 0 when every channel valve is shut. */
  selectedOutput: number;
  /** Every zone, archived included — history needs the archived ones (web ADR-0014). */
  zones: Zone[];
  /** Current output channel -> zone id. A channel with no zone is absent. */
  assignments: Record<number, string>;
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
  output_1: "switch", output_2: "switch", output_3: "switch", output_4: "switch",
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
  /** Output channel watered, or null when the controller recorded none (device sends 0). */
  outputChannel: number | null;
  /** The zone assigned to that channel when this event ran (web ADR-0014). */
  zoneId: string | null;
  /** That zone's current name (web ADR-0015). */
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
  /**
   * The channel is an input to the run, not the device's current selection: a
   * start always names where the water goes, so it is required.
   */
  "start-irrigation": { channel: OutputChannel };
  "stop-irrigation": Record<string, never>;
  "toggle-pump": Record<string, never>;
  "select-valve": { valve: ValveSelection };
  "set-cycle-mode": { mode: CycleMode };
  "set-pre-wet-percent": { value: number };
  "set-cycle-target": { value: number };
  "set-flush-duration": { value: number };
  "set-min-flow": { value: number };
  "reset-total-water": Record<string, never>;
  /** 0 shuts every output channel. */
  "select-output": { channel: number };
  "create-zone": { name: string };
  "rename-zone": { id: string; name: string };
  "archive-zone": { id: string };
  "unarchive-zone": { id: string };
  /**
   * The whole assignation table at once: one-to-one is a table-level invariant,
   * so it is validated and written as a unit under one `valid_from`.
   */
  "set-assignments": { assignments: Record<number, string | null> };
};
export type CommandName = keyof CommandBodies;
