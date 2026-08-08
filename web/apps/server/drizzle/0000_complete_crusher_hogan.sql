CREATE TABLE `watering_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` text NOT NULL,
	`seq` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`litres_delivered` real NOT NULL,
	`outcome` text NOT NULL,
	`trigger` text NOT NULL,
	`channel` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watering_events_device_id_seq_unique` ON `watering_events` (`device_id`,`seq`);