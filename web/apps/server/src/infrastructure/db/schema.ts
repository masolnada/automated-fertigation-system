import { sqliteTable, index, integer, real, text, unique } from "drizzle-orm/sqlite-core";

/**
 * One completed watering event, as reported by the controller (the authoritative
 * source; see controller ADR-0012). The server ingests these from the retained
 * `watering/log` topic and dedups by `(device_id, seq)`. `id` is a server-local
 * row id; the device-scoped identity is `(device_id, seq)`.
 *
 * `output_channel` is the numbered relay, which is all the device knows. The
 * zone it watered is resolved through the assignment in force at `ended_at`
 * (web ADR-0014).
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
    /** Output channel watered; null when the controller recorded none. */
    outputChannel: integer("output_channel"),
  },
  (table) => [unique().on(table.deviceId, table.seq)],
);

/**
 * A place that gets watered (web ADR-0014). Identified by `id`, so renaming and
 * re-plumbing both leave identity intact. `name` is current-only: a rename
 * relabels this zone's whole history, because it is the same place under a new
 * name (web ADR-0015). Archiving takes a zone out of the selectable list and
 * clears its assignment, but preserves everything it ever watered.
 */
export const zones = sqliteTable("zones", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Append-only assignation table: which zone each output channel fed, and from
 * when (web ADR-0014). A watering event's zone is resolved by finding the latest
 * `validFrom` at or before the event's end — the controller is offline for weeks,
 * so ingest time and run time are far apart, and resolving against the current
 * table would file old water against whatever the channel feeds now.
 *
 * `zoneId` null records a channel being cleared, so "unassigned since May" is
 * as expressible as any other assignment. The latest row per channel is the
 * current assignment.
 */
export const outputAssignments = sqliteTable(
  "output_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    outputChannel: integer("output_channel").notNull(),
    zoneId: text("zone_id"),
    validFrom: integer("valid_from", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("output_assignments_channel_valid_from").on(table.outputChannel, table.validFrom)],
);
