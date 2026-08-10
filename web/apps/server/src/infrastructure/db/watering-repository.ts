import type { WateringEvent, WateringHistory, WateringOutcome, WateringTrigger } from "@hort/contracts";
import { and, asc, desc, gt, gte, isNotNull, lt } from "drizzle-orm";
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
    return this.db.select().from(wateringEvents).orderBy(desc(wateringEvents.seq), desc(wateringEvents.id)).limit(limit).all().map(toWire);
  }

  history(since: Date, until: Date): WateringHistory {
    const chartEvents = this.db.select().from(wateringEvents)
      .where(and(gte(wateringEvents.endedAt, since), lt(wateringEvents.endedAt, until)))
      .orderBy(asc(wateringEvents.endedAt), asc(wateringEvents.seq)).all().map(toWire);
    const lastRow = this.db.select().from(wateringEvents)
      .where(gt(wateringEvents.litresDelivered, 0))
      .orderBy(desc(wateringEvents.seq), desc(wateringEvents.id)).limit(1).get();
    const earliestRow = this.db.select().from(wateringEvents)
      .where(isNotNull(wateringEvents.endedAt))
      .orderBy(asc(wateringEvents.endedAt), asc(wateringEvents.id)).limit(1).get();
    return {
      chartEvents,
      lastWatering: lastRow ? toWire(lastRow) : null,
      earliestEventAt: earliestRow?.endedAt?.toISOString() ?? null,
    };
  }
}
