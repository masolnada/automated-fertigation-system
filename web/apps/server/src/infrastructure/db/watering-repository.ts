import type { WateringEvent, WateringOutcome, WateringTrigger } from "@hort/contracts";
import { desc } from "drizzle-orm";
import type { IngestedWateringEvent, WateringEventRepository } from "../../domain/ports";
import type { Db } from "./database";
import { wateringEvents } from "./schema";

type Row = typeof wateringEvents.$inferSelect;
const toWire = (row: Row): WateringEvent => ({
  id: row.id,
  deviceId: row.deviceId,
  seq: row.seq,
  startedAt: row.startedAt ? row.startedAt.toISOString() : null,
  endedAt: row.endedAt ? row.endedAt.toISOString() : null,
  litresDelivered: row.litresDelivered,
  outcome: row.outcome as WateringOutcome,
  trigger: row.trigger as WateringTrigger,
  channel: row.channel,
});

/** SQLite/Drizzle adapter for WateringEventRepository. bun-sqlite is synchronous. */
export class DrizzleWateringEventRepository implements WateringEventRepository {
  constructor(private db: Db) {}

  ingest(events: IngestedWateringEvent[]): void {
    if (events.length === 0) return;
    this.db.insert(wateringEvents).values(events).onConflictDoNothing().run();
  }

  recent(limit: number): WateringEvent[] {
    return this.db.select().from(wateringEvents).orderBy(desc(wateringEvents.startedAt)).limit(limit).all().map(toWire);
  }
}
