import type { WateringEvent, WateringHistory } from "@hort/contracts";

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
  zone: number | null;
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
 * Zone names, stored append-only so history keeps the name in force when each
 * event ran (web ADR-0010).
 */
export interface ZoneNameRepository {
  /** Current name of every named zone. */
  current(): Record<number, string>;
  /** Record a new name, valid from now. No-op when unchanged. */
  rename(zone: number, name: string, at?: Date): void;
}
