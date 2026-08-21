import type { ScheduleEntry, Snapshot, Zone } from "@hort/contracts";

export interface ControllerSnapshotPort {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Snapshot;
  setZones(zones: Zone[], assignments: Record<number, string>): void;
  setSchedules(schedules: ScheduleEntry[]): void;
  setResetPending(pending: boolean): void;
}
