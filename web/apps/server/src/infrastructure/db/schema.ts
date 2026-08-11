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
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    litresDelivered: real("litres_delivered").notNull(),
    outcome: text("outcome").notNull(),
    trigger: text("trigger").notNull(),
    /** Zone watered; null when the controller recorded none. */
    zone: integer("zone"),
  },
  (table) => [unique().on(table.deviceId, table.seq)],
);

/**
 * Append-only history of what each zone has been called (web ADR-0010). A
 * watering event is labelled with the name in force when it ran, resolved by
 * finding the latest `validFrom` at or before the event's end — the controller
 * is offline for weeks, so ingest time and run time are far apart. The latest
 * row per zone is also the current name.
 */
export const zoneNames = sqliteTable("zone_names", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  zone: integer("zone").notNull(),
  name: text("name").notNull(),
  validFrom: integer("valid_from", { mode: "timestamp_ms" }).notNull(),
});
