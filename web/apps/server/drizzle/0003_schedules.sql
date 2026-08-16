-- Schedule entries (web ADR-0017, controller ADR-0018).
--
-- A standing instruction to water: when, how often, which channel, and the whole
-- cycle recipe to water with. The server authors these; the controller fires
-- them from its own RTC, so they must be complete enough to run with no network.
--
-- Additive: nothing here touches watering history, and an empty table is a
-- system with no schedules, which is what every existing deployment has.

CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	-- Local wall-clock `HH:MM` on the controller, not UTC: the operator means
	-- "6am", which follows DST rather than drifting an hour twice a year.
	`time` text NOT NULL,
	-- JSON, one of `{"kind":"weekdays","days":[1,4]}` or
	-- `{"kind":"everyN","n":3,"from":"2026-03-14"}`. A closed union the server
	-- never queries into — the controller is what evaluates it.
	`frequency` text NOT NULL,
	-- A channel and not a zone: the controller fires offline and can only honour
	-- a channel (web ADR-0016). Re-plumbing therefore redirects the entries
	-- standing on it, which the assignation editor warns about.
	`output_channel` integer NOT NULL,
	-- The recipe is stored per entry rather than read from the device's globals,
	-- so two entries can water differently and neither disturbs the other
	-- (controller ADR-0018).
	`cycle_mode` text NOT NULL,
	`cycle_total` real NOT NULL,
	`pre_wet_percent` real NOT NULL,
	`flush_minutes` real NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
-- Archiving a zone deletes the entries on its channel, and the card lists them
-- per channel, so this is the only access path that needs help.
CREATE INDEX `schedules_output_channel` ON `schedules` (`output_channel`);
