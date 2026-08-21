-- The zone palette was replaced with a hue-spread set (web ADR-0018): the old
-- blue-to-magenta keys read as near-identical. Remap each existing Zone to the
-- new key that holds its position, so live Zones simply re-tint with no loss of
-- identity. The two-step temporary values avoid transient collisions with the
-- unique constraint while the bijection is applied.
UPDATE `zones` SET `colour` = CASE `colour`
	WHEN 'petrol' THEN '__remap_1'
	WHEN 'sapphire' THEN '__remap_2'
	WHEN 'cobalt' THEN '__remap_3'
	WHEN 'indigo' THEN '__remap_4'
	WHEN 'violet' THEN '__remap_5'
	WHEN 'purple' THEN '__remap_6'
	WHEN 'orchid' THEN '__remap_7'
	WHEN 'magenta' THEN '__remap_8'
	ELSE `colour`
END;
--> statement-breakpoint
UPDATE `zones` SET `colour` = CASE `colour`
	WHEN '__remap_1' THEN 'terracotta'
	WHEN '__remap_2' THEN 'ochre'
	WHEN '__remap_3' THEN 'olive'
	WHEN '__remap_4' THEN 'teal'
	WHEN '__remap_5' THEN 'petrol'
	WHEN '__remap_6' THEN 'indigo'
	WHEN '__remap_7' THEN 'purple'
	WHEN '__remap_8' THEN 'magenta'
	ELSE `colour`
END;
