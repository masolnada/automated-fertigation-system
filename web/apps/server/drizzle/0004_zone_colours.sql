-- A Zone colour is a permanent, server-owned identity selected from the fixed
-- palette (web ADR-0018). Existing Zones predate selection, so assign them in
-- creation order using the same stable order presented by the dashboard.
--
-- SQLite cannot add a NOT NULL unique column to populated rows directly. Rebuild
-- the table so the uniqueness constraint is authoritative for concurrent writes.
CREATE TABLE `__new_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`colour` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `zones_colour_unique` UNIQUE(`colour`)
);
--> statement-breakpoint
WITH `ordered` AS (
	SELECT
		`id`,
		`name`,
		`archived`,
		`created_at`,
		row_number() OVER (ORDER BY `created_at`, `id`) AS `position`
	FROM `zones`
)
INSERT INTO `__new_zones` (`id`, `name`, `colour`, `archived`, `created_at`)
SELECT
	`id`,
	`name`,
	CASE `position`
		WHEN 1 THEN 'petrol'
		WHEN 2 THEN 'sapphire'
		WHEN 3 THEN 'cobalt'
		WHEN 4 THEN 'indigo'
		WHEN 5 THEN 'violet'
		WHEN 6 THEN 'purple'
		WHEN 7 THEN 'orchid'
		WHEN 8 THEN 'magenta'
	END,
	`archived`,
	`created_at`
FROM `ordered`;
--> statement-breakpoint
DROP TABLE `zones`;
--> statement-breakpoint
ALTER TABLE `__new_zones` RENAME TO `zones`;
