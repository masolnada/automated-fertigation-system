import { and, asc, desc, gt, gte, isNotNull, lt } from "drizzle-orm";
import type { Db } from "../../../infrastructure/db/database";
import { wateringEvents } from "../../../infrastructure/db/schema";
import type { ZoneRepository } from "../../zones/application/zone-repository";
import { WateringEvent } from "../domain/watering-event";
import type { StoredWateringEvent, WateringEventRepository, WateringHistoryResult } from "../application/watering-event-repository";

type Row = typeof wateringEvents.$inferSelect;
const rehydrate = (row: Row): StoredWateringEvent => ({ rowId: row.id, event: WateringEvent.rehydrate(row) });

export class DrizzleWateringEventRepository implements WateringEventRepository {
  constructor(private db: Db, readonly zones?: ZoneRepository) {}
  ingest(events: WateringEvent[]): void {
    if (events.length === 0) return;
    this.db.insert(wateringEvents).values(events.map((event) => ({
      deviceId: event.id.deviceId.toString(), seq: event.id.sequence.toNumber(),
      startedAt: event.timeRange.startedAt.toDate(), endedAt: event.timeRange.endedAt.toDate(),
      litresDelivered: event.litresDelivered.toNumber(), outcome: event.outcome.toString(), trigger: event.trigger.toString(),
      outputChannel: event.outputChannel?.toNumber() ?? null,
    }))).onConflictDoNothing().run();
  }
  recent(limit: number): StoredWateringEvent[] { return this.db.select().from(wateringEvents).orderBy(desc(wateringEvents.seq), desc(wateringEvents.id)).limit(limit).all().map(rehydrate); }
  history(since: Date, until: Date): WateringHistoryResult {
    const chartEvents = this.db.select().from(wateringEvents).where(and(gte(wateringEvents.endedAt, since), lt(wateringEvents.endedAt, until))).orderBy(asc(wateringEvents.endedAt), asc(wateringEvents.seq)).all().map(rehydrate);
    const last = this.db.select().from(wateringEvents).where(gt(wateringEvents.litresDelivered, 0)).orderBy(desc(wateringEvents.seq), desc(wateringEvents.id)).limit(1).get();
    const earliest = this.db.select().from(wateringEvents).where(isNotNull(wateringEvents.endedAt)).orderBy(asc(wateringEvents.endedAt), asc(wateringEvents.id)).limit(1).get();
    return { chartEvents, lastWatering: last ? rehydrate(last) : null, earliestEventAt: earliest?.endedAt ?? null };
  }
}
