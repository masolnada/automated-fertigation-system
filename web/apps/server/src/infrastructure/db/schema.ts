import { sqliteTable, integer, real, text, unique } from "drizzle-orm/sqlite-core";

/**
 * One completed watering event, as reported by the controller (the authoritative
 * source; see controller ADR-0012). The server ingests these from the retained
 * `watering/log` topic and dedups by `(device_id, seq)`. `id` is a server-local
 * row id; the device-scoped identity is `(device_id, seq)`.
 */
export const wateringEvents = sqliteTable(
  "watering_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deviceId: text("device_id").notNull(),
    seq: integer("seq").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }).notNull(),
    litresDelivered: real("litres_delivered").notNull(),
    outcome: text("outcome").notNull(),
    trigger: text("trigger").notNull(),
    channel: text("channel"),
  },
  (table) => [unique().on(table.deviceId, table.seq)],
);
