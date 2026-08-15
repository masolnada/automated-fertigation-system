-- Output channels become generic and a Zone becomes an entity (web ADR-0014),
-- with names current-only (web ADR-0015, superseding ADR-0010).
--
-- Written by hand rather than generated: drizzle-kit cannot express the
-- zone_names -> zones + output_assignments carry-over, and the column rename
-- needs a prompt. Unlike ADR-0009's and 0001's destructive recreations this one
-- preserves data, because watering history is the thing the whole change exists
-- to keep correct.

-- The device only ever knew a numbered relay; that is what the column now says.
ALTER TABLE `watering_events` RENAME COLUMN `zone` TO `output_channel`;
--> statement-breakpoint
CREATE TABLE `zones` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `output_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`output_channel` integer NOT NULL,
	`zone_id` text,
	`valid_from` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `output_assignments_channel_valid_from` ON `output_assignments` (`output_channel`,`valid_from`);
--> statement-breakpoint
-- Each numbered zone becomes one Zone entity keeping its *latest* name: names
-- are current-only now, so the newest row is the name, and the older rows were
-- only ever a way to say "this channel used to mean something else" — which the
-- assignment table now says properly.
INSERT INTO `zones` (`id`, `name`, `archived`, `created_at`)
SELECT
	lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
	`latest`.`name`,
	0,
	`latest`.`valid_from`
FROM (
	SELECT `zone`, `name`, `valid_from`,
		row_number() OVER (PARTITION BY `zone` ORDER BY `valid_from` DESC, `id` DESC) AS `rn`,
		min(`valid_from`) OVER (PARTITION BY `zone`) AS `first_seen`
	FROM `zone_names`
) AS `latest`
WHERE `latest`.`rn` = 1;
--> statement-breakpoint
-- Every migrated zone stays on the channel it was named after, valid from when
-- that channel was first named — the closest thing on record to when it started
-- feeding that place.
INSERT INTO `output_assignments` (`output_channel`, `zone_id`, `valid_from`)
SELECT `n`.`zone`, `z`.`id`, min(`n`.`valid_from`)
FROM `zone_names` AS `n`
JOIN `zones` AS `z` ON `z`.`name` = (
	SELECT `inner`.`name` FROM `zone_names` AS `inner`
	WHERE `inner`.`zone` = `n`.`zone`
	ORDER BY `inner`.`valid_from` DESC, `inner`.`id` DESC
	LIMIT 1
)
GROUP BY `n`.`zone`, `z`.`id`;
--> statement-breakpoint
DROP TABLE `zone_names`;
