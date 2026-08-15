import type { WateringEvent, WateringHistory, Zone } from "@hort/contracts";

// The application depends on this port, never on `mqtt` directly.
export interface DevicePort {
  readonly prefix: string;
  publish(topic: string, payload: string, options?: { retain?: boolean }): void;
  /** Register a one-shot-style listener for `flow/reset_total/result`; returns an unsubscribe. */
  onResetResult(callback: (result: string) => void): () => void;
  /** Register a listener for the retained `watering/log` payload; returns an unsubscribe. */
  onWateringLog(callback: (payload: string) => void): () => void;
}

/** A watering event as reported by the controller, ready to persist. */
export type IngestedWateringEvent = {
  deviceId: string;
  seq: number;
  startedAt: Date | null;
  endedAt: Date | null;
  litresDelivered: number;
  outcome: string;
  trigger: string;
  outputChannel: number | null;
};

// Persistence for watering events, behind which the SQLite/Drizzle adapter lives.
export interface WateringEventRepository {
  /** Insert events, ignoring any whose `(deviceId, seq)` is already stored. */
  ingest(events: IngestedWateringEvent[]): void;
  /** Recent events, newest first in controller sequence order. */
  recent(limit: number): WateringEvent[];
  /** Events in a half-open range plus global watering-history metadata. */
  history(since: Date, until: Date): WateringHistory;
}

/**
 * Zones and the append-only assignation table (web ADR-0014). Names are
 * current-only (web ADR-0015); what stays temporal is the channel-to-zone
 * assignment, so a watering event resolves to the zone that was on its channel
 * when it ran.
 */
export interface ZoneRepository {
  /** Every zone, archived included — history needs the archived ones. */
  all(): Zone[];
  create(name: string, at?: Date): Zone;
  rename(id: string, name: string): void;
  /** Archive and clear any channel assignment pointing at this zone. */
  archive(id: string, at?: Date): void;
  /** Restore to the selectable list. Does not restore the assignment. */
  unarchive(id: string): void;
  /** Current output channel -> zone id. Unassigned channels are absent. */
  currentAssignments(): Record<number, string>;
  /** Write the whole table under one `validFrom`; unchanged channels write nothing. */
  setAssignments(next: Record<number, string | null>, at?: Date): void;
  /** The zone on `channel` at `at`, for resolving a watering event. */
  zoneAt(channel: number, at: Date | null): string | null;
  nameOf(zoneId: string): string | null;
}
