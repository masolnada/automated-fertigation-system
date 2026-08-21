import type { WateringEvent } from "../domain/watering-event";

export type StoredWateringEvent = { rowId: number; event: WateringEvent };
export type WateringHistoryResult = {
  chartEvents: StoredWateringEvent[];
  lastWatering: StoredWateringEvent | null;
  earliestEventAt: Date | null;
};

export interface WateringEventRepository {
  ingest(events: WateringEvent[]): void;
  recent(limit: number): StoredWateringEvent[];
  history(since: Date, until: Date): WateringHistoryResult;
}
