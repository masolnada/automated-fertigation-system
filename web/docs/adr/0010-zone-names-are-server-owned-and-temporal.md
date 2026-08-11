# Zone names are server-owned and resolved as of the event that used them

Operator-authored zone names ("Olive terrace") live on the server in an
append-only table of `(zone, name, valid_from)`. A watering event stores only the
numeric zone; its label is resolved by finding the latest name whose `valid_from`
precedes the event's end. The current name for the live dashboard is the latest
row per zone.

Two things force this shape. First, a zone name is not display metadata in the
sense of ADR-0005: it is authored in the field, outlives any deploy, and must
read identically on every browser — so it cannot be a client-side constant.
Second, the controller is offline for weeks by design (controller ADR-0012), so
events are routinely ingested long after they ran. Stamping the *current* name
onto each event at ingest would label three weeks of backfilled history with a
name that did not exist when any of it happened, and the original would be
unrecoverable.

## Consequences

- Renaming a zone relabels nothing retroactively; history keeps the name in force
  at the time.
- Events with no valid clock (`endedAt` null — already possible when the RTC is
  unset) fall back to the zone's current name.
- ADR-0005 still holds for entity labels, units and decimals; this is the
  boundary case it did not anticipate.
