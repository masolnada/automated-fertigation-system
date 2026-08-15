# The channel travels with the start, rather than being set beforehand

`irrigation_sequence` used to read the persisted `selected_output` global,
because the only way to choose a channel was to open its valve from the
dashboard — the sequence simply watered whatever was already open. It now takes
the channel as a script parameter, carried on the `irrigation/start` payload,
and opens it as its first act. This is groundwork for the device-side scheduler:
a schedule entry is `(time, channel, …)` and must name its own channel, so
"water whatever is open" stops being expressible the moment two entries exist.

## Considered options

Setting `selected_output` first and then executing the unparameterised script
would have needed no firmware change beyond parsing the payload. It was rejected
because it makes the channel ambient rather than an input: two schedule entries
firing close together would race on one global, and every scheduled run would
mutate the selection as a deliberate side effect rather than as a record of what
it opened. A retained `irrigation/channel` topic published before the start has
the same problem plus a two-message race, for a value that is plainly an
argument.

Server-side scheduling was rejected before this decision was reachable: the
controller spends weeks in the field with no WiFi (ADR-0012) and carries an RTC
for exactly this reason (ADR-0013), so a scheduler that only fires while the
device has network contradicts the deployment.

## Consequences

- `irrigation/start` carries the channel as its payload; `"ON"` no longer starts
  anything. A payload naming no channel in 1–4 is refused and logged, never sent
  to whichever valve was last left open — silently watering the wrong zone is
  worse than not watering. The `Start Irrigation` button entity has no payload to
  carry, so it waters the Selected Output and refuses when there is none.
- The sequence closes the other output channels before opening its own. A pump
  running manually on a different channel therefore loses its path and is stopped
  by the interlock for about a second, then restarted by phase 1 — the same pause
  every source handover already takes. The alternative, opening before closing,
  would leave two channels open briefly and mis-meter the overlap into a watering
  event, and history cannot be corrected later.
- `selected_output` remains the record of what is open and what the offline
  manual button waters. A run still writes it, because opening a valve writes it,
  so a scheduled run does change where the button will next send water. Accepted:
  standing at the box with no network, "water what ran last" is the only channel
  the button can know about.
- `watering_events.h` is untouched. The channel is stamped at pump-on from the
  global, and the sequence opens its channel before phase 1 starts the pump.
- The server's `start-irrigation` command takes a required `channel`. There is no
  fallback to the device's selection, since that would reintroduce the path this
  decision exists to remove.
