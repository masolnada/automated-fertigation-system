import { sqliteTable, integer, real, text } from "drizzle-orm/sqlite-core";

/**
 * One watering event = a pump-on span (see the glossary). A row is inserted at
 * pump-on (`endedAt` null) and finalized after the debounce confirms the pump
 * stayed off. `startTotalWater` is the Total Water counter at pump-on, kept so
 * litres and reconciliation survive a mid-watering restart. `trigger`/`outcome`
 * are reserved for later enrichment and stay null for now.
 */
export const wateringEvents = sqliteTable("watering_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  startTotalWater: real("start_total_water").notNull(),
  litresDelivered: real("litres_delivered"),
  peakFlow: real("peak_flow"),
  avgFlow: real("avg_flow"),
  trigger: text("trigger"),
  outcome: text("outcome"),
});
