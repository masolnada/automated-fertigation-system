import type { WateringEvent } from "@hort/contracts";

// The application depends on this port, never on `mqtt` directly.
export interface DevicePort {
  readonly prefix: string;
  publish(topic: string, payload: string, options?: { retain?: boolean }): void;
  /** Register a one-shot-style listener for `flow/reset_total/result`; returns an unsubscribe. */
  onResetResult(callback: (result: string) => void): () => void;
}

// Persistence for watering events, behind which the SQLite/Drizzle adapter lives.
export interface WateringEventRepository {
  /** Insert an open event at pump-on; returns its id. */
  insertOpen(startedAt: Date, startTotalWater: number): number;
  /** Close an event once the debounce confirms the pump stayed off. */
  finalize(id: number, endedAt: Date, litresDelivered: number, peakFlow: number | null, avgFlow: number | null): void;
  /** The most recent still-open event (for startup reconciliation), if any. */
  openEvent(): { id: number; startTotalWater: number } | undefined;
  /** Recent events, newest first, for the read endpoint. */
  recent(limit: number): WateringEvent[];
}
