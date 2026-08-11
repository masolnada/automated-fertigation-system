-- Zones replace the reserved `channel` placeholder, and zone names get an
-- append-only temporal table (web ADR-0010). `channel` was never populated
-- (the firmware always emitted null), so the events table is recreated in the
-- new shape rather than altered — the same reasoning as ADR-0009's destructive
-- migration.
DROP TABLE `watering_events`;
--> statement-breakpoint
CREATE TABLE `watering_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` text NOT NULL,
	`seq` integer NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`litres_delivered` real NOT NULL,
	`outcome` text NOT NULL,
	`trigger` text NOT NULL,
	`zone` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watering_events_device_id_seq_unique` ON `watering_events` (`device_id`,`seq`);
--> statement-breakpoint
CREATE TABLE `zone_names` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`zone` integer NOT NULL,
	`name` text NOT NULL,
	`valid_from` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `zone_names_zone_valid_from` ON `zone_names` (`zone`,`valid_from`);
