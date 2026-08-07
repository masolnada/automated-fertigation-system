CREATE TABLE `watering_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`start_total_water` real NOT NULL,
	`litres_delivered` real,
	`peak_flow` real,
	`avg_flow` real,
	`trigger` text,
	`outcome` text
);
