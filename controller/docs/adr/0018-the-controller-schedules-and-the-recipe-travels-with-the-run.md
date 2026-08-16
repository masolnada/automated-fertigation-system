# The controller holds and fires the schedule, and every run carries its own recipe

Scheduled irrigation is authored on the dashboard but **executed by the
controller**, from its own RTC, from a copy of the schedule it keeps in NVS. And
a schedule entry carries the whole cycle recipe it waters with — mode, total,
pre-wet percent and flush — rather than reading the device's `cycle_*` entities.
`irrigation_sequence` therefore takes the recipe as parameters, as it already
took the channel (ADR-0017).

Both halves follow from the same fact ADR-0017 recorded when it made the channel
a parameter: the controller spends weeks in the field with no WiFi (ADR-0012)
and carries a clock for exactly this reason (ADR-0013). A scheduler that only
fired while the server could reach it would contradict the deployment. And a
schedule entry that read shared globals would water differently depending on what
someone last adjusted by hand, so two entries could not differ at all — the same
defect that made "water whatever is open" unexpressible.

## Considered options

**Server-side scheduling (rejected, again).** ADR-0017 already rejected it. The
server has a database, a timezone library and no flash-wear budget, so it is the
easier place to put a scheduler; it is simply the wrong one. The controller is
disconnected for most of the season, which is when the schedule most needs to
run.

**A recipe per zone rather than per entry (rejected).** "The olive terrace gets
200 L" is arguably a property of the terrace, and a manual run of that zone would
want it too. But a zone exists only on the server (web ADR-0014), and the device
must fire offline, so the device would have to hold a recipe per *channel* — a
zone concept smuggled into firmware under another name, with the operator-visible
half left on the server. Rejected as the right model at the wrong layer.

**Keeping the recipe global and having each entry write it before starting
(rejected).** No sequence refactor. But then every scheduled run mutates the
operator's visible configuration as a side effect, the dashboard's numbers move
on their own overnight, and two entries firing close together race on one global.
This is ADR-0017's argument verbatim, and it applies unchanged.

**Weekday mask plus every-N-days, and no monthly (chosen).** Daily, weekly and
"several days a week" are one control — a 7-bit mask — not three kinds of
schedule. Monthly was dropped: it needs a day-of-month, which drags in the
short-month problem (there is no 31st of February, and whatever you pick the
operator must *know* it, offline, from a box with no screen), and a monthly
cadence is a poor fit for irrigation anyway. Every-N-days covers the sparse case
honestly and expresses "every 3 days", which is a real irrigation interval.

**Anchored to a stored start date rather than to the last run (chosen).** Both
frequency forms are pure functions of the calendar date, so the device answers
"does this fire today?" from the RTC alone. Counting N days from the last run
reads more naturally and self-corrects a missed run, but it needs durable
per-entry state and it drifts: on a solar rig "every 3 days" quietly becomes
every 4 or 5 over a season, because the weeks this controller spends dark are
exactly when runs are missed.

## Consequences

- `irrigation_sequence` takes `(channel, volume, total, prewet, flush)`. The
  parameters are copied to `run_*` globals on entry, because ESPHome's `delay`
  and `wait_until` lambdas are separate callbacks that cannot see script
  parameters. The recovery flush reads `run_flush`, so it flushes for as long as
  the run it is rescuing asked for.
- The `cycle_*` entities are no longer what a commanded run waters with. They are
  the **default recipe**: what the physical button uses, since a button has no
  payload to carry one, and the values the dashboard proposes a new irrigation
  with. They keep their names, because that is what they still are on the device's
  own web UI.
- `irrigation/start` carries JSON — channel plus recipe — where it carried a bare
  channel number. A payload missing either, or naming a flush below one minute, is
  refused and logged rather than completed from device state.
- A new retained topic, `schedule/set`, carries the whole set. Whole-set
  replacement rather than per-entry edits: an entry is immutable (web ADR-0017),
  and a retained topic is what lets a reconnecting device catch up with no
  reconciliation protocol. A malformed payload keeps the previous set — dropping
  every schedule because one byte was wrong would silently stop all watering.
- The set is capped at 16 entries in NVS (~1 KB, against the watering log's
  ~3.8 KB), and the server refuses a seventeenth so an entry that would never
  fire cannot be created.
- Two new enum values on the watering event. `trigger` gains `scheduled`, because
  "is the schedule working?" is a question only the history can answer, and it
  cannot if a run the controller started on its own is indistinguishable from one
  a person asked for. `outcome` gains `skipped`, written when an entry's turn
  comes while the controller is already watering: the sequence is `mode: single`
  and refuses the second start, and a zone that silently went unwatered has to be
  visible. A skipped run has no pump-on span, equal start and end, and zero
  litres. It is not counted as an error — nothing failed, two entries simply
  collided, and the fix is for the operator to move one.
- The trigger is recorded as *what kind of thing* started the run, never *which*
  entry. Entries are server-side and get deleted; history must not carry
  references to rows that no longer exist.
- `timezone: Europe/Madrid` is now pinned on both time platforms. It was
  previously absent, which means ESPHome inferred it from the *build machine* —
  harmless when every build happened in Barcelona, and silently an hour or two
  wrong from anywhere else. Schedules are local wall-clock, so this also gives
  them DST: 06:00 stays 06:00 across the March and October changes.
- Firing is checked every 20 s rather than every 60, so a late tick cannot miss a
  minute; each entry records the minute it fired in and will not fire twice
  within it. That record is RAM-only: a reboot inside the same minute could fire
  an entry twice, which `mode: single` already makes harmless.
- No valid RTC means nothing fires. A fresh or dead-coin-cell clock has no idea
  what day it is, and watering blind is worse than not watering.
