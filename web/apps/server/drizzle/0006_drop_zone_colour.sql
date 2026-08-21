-- Zone colour is now a browser-local presentational aid with no server side
-- (web ADR-0019, superseding ADR-0018). Drop the stored `colour` column. It
-- carries a UNIQUE constraint, so `ALTER TABLE ... DROP COLUMN` is refused;
-- rebuild the table without it, preserving every row.
CREATE TABLE `__new_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_zones` (`id`, `name`, `archived`, `created_at`)
SELECT `id`, `name`, `archived`, `created_at` FROM `zones`;
--> statement-breakpoint
DROP TABLE `zones`;
--> statement-breakpoint
ALTER TABLE `__new_zones` RENAME TO `zones`;
