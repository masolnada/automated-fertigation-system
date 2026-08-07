import type { WateringEvent } from "@hort/contracts";
import { desc, eq, isNull } from "drizzle-orm";
import type { WateringEventRepository } from "../../domain/ports";
import type { Db } from "./database";
import { wateringEvents } from "./schema";

type Row = typeof wateringEvents.$inferSelect;
const toWire = (row: Row): WateringEvent => ({
  id: row.id,
  startedAt: row.startedAt.toISOString(),
  endedAt: row.endedAt ? row.endedAt.toISOString() : null,
  litresDelivered: row.litresDelivered,
  peakFlow: row.peakFlow,
  avgFlow: row.avgFlow,
});

/** SQLite/Drizzle adapter for WateringEventRepository. bun-sqlite is synchronous. */
export class DrizzleWateringEventRepository implements WateringEventRepository {
  constructor(private db: Db) {}

  insertOpen(startedAt: Date, startTotalWater: number): number {
    const [row] = this.db.insert(wateringEvents).values({ startedAt, startTotalWater }).returning({ id: wateringEvents.id }).all();
    return row!.id;
  }

  finalize(id: number, endedAt: Date, litresDelivered: number, peakFlow: number | null, avgFlow: number | null): void {
    this.db.update(wateringEvents).set({ endedAt, litresDelivered, peakFlow, avgFlow }).where(eq(wateringEvents.id, id)).run();
  }

  openEvent(): { id: number; startTotalWater: number } | undefined {
    const [row] = this.db.select({ id: wateringEvents.id, startTotalWater: wateringEvents.startTotalWater }).from(wateringEvents).where(isNull(wateringEvents.endedAt)).orderBy(desc(wateringEvents.id)).limit(1).all();
    return row ?? undefined;
  }

  recent(limit: number): WateringEvent[] {
    return this.db.select().from(wateringEvents).orderBy(desc(wateringEvents.startedAt)).limit(limit).all().map(toWire);
  }
}
