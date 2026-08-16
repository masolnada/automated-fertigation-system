# The dashboard speaks zones; the output channel is a firmware concept

ADR-0014 split the numbered relay (an **output channel**) from the place it
waters (a **Zone**), and both words then appeared on screen — the irrigation
picker offered "Olive terrace" with "Output 1" beneath it, zone rows carried an
"Output 3" badge, and the pump's blocked reason read "Open an output." The
operator does not think in relays: they water the olive terrace. Output channel
is therefore a firmware, server and wire term only, and the dashboard names
zones.

The word survives in exactly two places on screen, both of them honest:

- **A channel with no zone assigned**, shown as "Output 4" — on the *schematic*
  and in the watering history. Such a channel still waters, and history that
  omitted the water it delivered would be wrong, so it cannot be hidden there.
  Naming it by its channel is also the visible prompt to go and assign it.

  It is **not** offered where an irrigation is *chosen*. Starting or scheduling
  one names a place, and "Output 4" is the absence of a place: the run would be
  recorded against no zone, and a schedule standing on it would water somewhere
  the dashboard cannot name. The operator can still send water to a bare channel
  from the schematic, which is the surface that speaks channels, and from the
  button on the box, which needs no server at all (ADR-0014).
- **The assignation editor**, whose entire job is to relate the two. A surface
  that maps channels to zones has to be able to say both words.

## Consequences

- An act the operator performs on a zone is still an act on a channel
  underneath: picking a zone to irrigate resolves through the assignation table
  to the channel carried on `start-irrigation`. The translation happens at the
  edge of the UI, not in the operator's head.
- A zone with no channel cannot be watered and does not appear in the irrigation
  picker, because there is no channel to send the water to. The Zones card is
  where such a zone is visible, badged as unassigned. The converse now also
  holds: a channel with no zone does not appear there either, so the picker is
  exactly the set of assignments — and with none, it says so and points at the
  assignation editor rather than offering four anonymous outputs.
- Zone rows say "Assigned"/"Unassigned" rather than naming the channel. Which
  channel a zone sits on is answered by the assignation editor, which is also the
  only place it can be changed.
- Wire types, MQTT topics, the SQLite schema and the watering event keep
  `outputChannel` unchanged. This decision is about what the operator reads, not
  about the model: ADR-0014's separation is what makes the substitution safe.
