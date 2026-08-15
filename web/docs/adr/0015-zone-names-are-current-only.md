---
status: supersedes ADR-0010
---

# Zone names are current-only; renaming relabels history

ADR-0010 made zone names temporal, keeping an append-only `(zone, name,
valid_from)` table so a watering event read under the name in force when it ran.
That was the right call *at the time* for one reason: a zone had no identity of
its own. It was just a relay number, so renaming was the only way to express
"this valve now feeds somewhere else", and stamping the current name onto
backfilled history would have destroyed the distinction.

ADR-0014 gives a Zone a UUID and makes reassignment a real operation, which
removes that reason. The temporality moves to the assignation table, where it
now belongs: an event resolves channel → zone-in-force-when-it-ran → whatever
that zone is called now. A name is therefore just a label on a stable identity,
and a rename means one thing only — "I called it the wrong thing". It relabels
that zone's whole history, which is correct, because it is the same place.

The other case — the place itself changed, a vegetable patch replanted as an
almond row — is expressed by **archiving the old zone and creating a new one**,
not by renaming. Archiving preserves the old zone's history under its own name
and clears its channel assignment; the new zone gets a new UUID and is assigned
in its place. Keeping both temporal layers was rejected: the zone card and its
own history rows would show different names with nothing recording whether that
was a typo fix or a replanting, and there would be two temporal resolutions to
reason about where one answers the question the operator actually asks.

## Consequences

- The `zone_names` table and its `nameAt` resolution are deleted. A zone carries
  one `name` column.
- `WateringEvent.zoneName` is now the zone's current name, not a historical one.
- Renaming is destructive to labels: rename after a real scope change and the old
  name is gone. Archive-and-create is the documented alternative, and the UI says
  so at the point of rename.
- Renaming no longer needs a Confirmation. ADR-0010's `ConfirmZoneRename` existed
  because a rename was not what it looked like; now it is, so it becomes a plain
  edit. Archiving keeps a confirmation, because clearing the channel assignment
  is a consequence not visible in the click.
