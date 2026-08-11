import type { WateringEvent, WateringHistory, WateringOutcome, WateringTrigger } from "@hort/contracts";
import { and, asc, desc, gt, gte, isNotNull, lt } from "drizzle-orm";
import type { IngestedWateringEvent, WateringEventRepository } from "../../domain/ports";
import type { Db } from "./database";
import { wateringEvents } from "./schema";

type Row = typeof wateringEvents.$inferSelect;

/** Resolves each event's zone name as of when it ran (web ADR-0010). */
type NameResolver = { nameAt(zone: number, at: Date | null): string | null };

const toWire = (row: Row, names?: NameResolver): WateringEvent => ({
  id: row.id,
  deviceId: row.deviceId,
  seq: row.seq,
  startedAt: row.startedAt ? row.startedAt.toISOString() : null,
  endedAt: row.endedAt ? row.endedAt.toISOString() : null,
  litresDelivered: row.litresDelivered,
  outcome: row.outcome as WateringOutcome,
  trigger: row.trigger as WateringTrigger,
  zone: row.zone,
  zoneName: row.zone === null ? null : names?.nameAt(row.zone, row.endedAt) ?? null,
});

/** SQLite/Drizzle adapter for WateringEventRepository. bun-sqlite is synchronous. */
export class DrizzleWateringEventRepository implements WateringEventRepository {
  constructor(private db: Db, private names?: NameResolver) {}

  ingest(events: IngestedWateringEvent[]): void {
    if (events.length === 0) return;
    this.db.insert(wateringEvents).values(events).onConflictDoNothing().run();
  }

  recent(limit: number): WateringEvent[] {
    return this.db.select().from(wateringEvents).orderBy(desc(wateringEvents.seq), desc(wateringEvents.id)).limit(limit).all().map((row) => toWire(row, this.names));
  }

  history(since: Date, until: Date): WateringHistory {
    const chartEvents = this.db.select().from(wateringEvents)
      .where(and(gte(wateringEvents.endedAt, since), lt(wateringEvents.endedAt, until)))
      .orderBy(asc(wateringEvents.endedAt), asc(wateringEvents.seq)).all().map((row) => toWire(row, this.names));
    const lastRow = this.db.select().from(wateringEvents)
      .where(gt(wateringEvents.litresDelivered, 0))
      .orderBy(desc(wateringEvents.seq), desc(wateringEvents.id)).limit(1).get();
    const earliestRow = this.db.select().from(wateringEvents)
      .where(isNotNull(wateringEvents.endedAt))
      .orderBy(asc(wateringEvents.endedAt), asc(wateringEvents.id)).limit(1).get();
    return {
      chartEvents,
      lastWatering: lastRow ? toWire(lastRow, this.names) : null,
      earliestEventAt: earliestRow?.endedAt?.toISOString() ?? null,
    };
  }
}
