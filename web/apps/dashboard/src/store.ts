import type { Snapshot as WireSnapshot, Severity } from "@hort/contracts";

export type LogEntry = { message: string; severity: Severity; time: Date };
/** Client snapshot: wire snapshot with log times parsed to Date plus a client-only SSE indicator. */
export type Snapshot = Omit<WireSnapshot, "log"> & { log: LogEntry[]; serverConnected: boolean };

const empty = (): Snapshot => ({ brokerConnected: false, deviceOnline: false, entities: {}, valves: { clean_water_valve: false, fertigation_valve: false, microbiology_valve: false }, selectedOutput: 0, zones: [], assignments: {}, resetPending: false, log: [], serverConnected: false });

/** Holds the latest server snapshot fed over SSE; exposed via useSyncExternalStore. */
export class SnapshotStore {
  private snapshot = empty();
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  private notify() { this.listeners.forEach((listener) => listener()); }
  replace(wire: WireSnapshot) { this.snapshot = { ...wire, log: wire.log.map((entry) => ({ ...entry, time: new Date(entry.time) })), serverConnected: this.snapshot.serverConnected }; this.notify(); }
  setServerConnected(serverConnected: boolean) { this.snapshot = { ...this.snapshot, serverConnected }; this.notify(); }
}
