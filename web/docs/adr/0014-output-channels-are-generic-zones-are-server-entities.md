# Output channels are generic; a Zone is a server-owned entity assigned to one

A downstream valve used to *be* a zone: relay 1 was the olive terrace, and
"zone 1" named both the hardware and the place. That conflation held only while
the plumbing never changed. It does change — a pipe gets moved to a different
part of the plot — so the two are now separate concepts. An **output channel** is
a numbered relay and nothing more, the firmware's word for a downstream valve. A
**Zone** is a place that gets watered, exists only on the server, and is
identified by a UUID rather than by which valve happens to feed it.

The bridge between them is an **assignation table** of `(output channel, zone
id, valid_from)`, append-only for the same reason zone names were temporal in
ADR-0010: the controller is offline for weeks by design (controller ADR-0012),
so events are routinely ingested long after they ran. A watering event stores
only the channel number; its zone is resolved by the assignment in force at the
event's end. Resolving against the *current* table would file two months of the
olive terrace's water against the almond row the first time a pipe was moved —
water attributed to the wrong soil, with the original unrecoverable. The
assignment is one-to-one in both directions, enforced as a table-level invariant,
because the hardware already opens exactly one zone valve at a time and a
sequence waters exactly one zone from start to finish.

Input channels are deliberately *not* generic. The Flush and the recovery flush
must know which valve is clean water, and they must know it with no network, so
that mapping stays fixed in firmware and Source stays a firmware constant with
no server-side identity. Nothing about the assignation table is pushed to the
device: the firmware never interprets an output channel, so it has no reader for
it.

## Consequences

- The word "zone" leaves the firmware entirely: `zone_N` becomes `output_N`, and
  the MQTT topics change with it. Telegraf and Grafana reference no zone topic,
  so Observability is unaffected.
- An assignment's `valid_from` is the server clock when the operator edits the
  table, while the event's time is the device RTC. Re-plumbing at 10:00 and
  updating the dashboard at 18:00 leaves the events in between resolving to the
  old zone. Temporal assignment narrows the window from months to hours; it
  cannot close it.
- Editing assignments is refused while the pump runs. Reassigning mid-run would
  split one pump-on span across two zones, which the temporal resolution cannot
  express.
- Zones may outnumber channels. A zone with no channel is normal and shown as
  inactive; a channel with no zone still waters, and its events record no zone —
  the manual button works with no server at all, so the server cannot enforce
  otherwise. The device is the safety authority; the server is the record-keeper.
- Archiving a zone clears its assignment, so a current assignment always points
  at a live zone. Past assignments keep pointing at the archived zone, which is
  what preserves its history.
- The channel count stops being interesting. Growing from four to seven outputs
  (which needs the second PCF8574 that controller ADR-0015 rejected) is now one
  constant plus firmware, with no change to the model.
