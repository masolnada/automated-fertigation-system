# Web

The operator-facing side of the system (`web/`): a React dashboard and the server
that fronts the device. The browser never speaks to the device directly — the
server owns MQTT and the browser talks to the server.

## Language

**Snapshot**:
The complete current state of the controller as the server sees it — entity
values, valve positions, reset-pending flag, and the rolling event log. The unit
of truth pushed to the browser; one snapshot per change.
_Avoid_: state dump, model.

**Entity**:
One device value addressed by object id and kind (`sensor`, `binary_sensor`,
`switch`, `number`, `select`). Carries an `EntityValue` (`value` + `known`).

**Command**:
An intent-named operation the browser asks of the server
(`start-irrigation`, `set-cycle-target`, `reset-total-water`, …), posted over
HTTP. The server validates and enforces it, then translates it to MQTT.
_Avoid_: action, message, event.

**Confirmation**:
A modal the operator must accept before a consequential act proceeds — starting
the pump, starting irrigation, resetting Total Water, and renaming a zone. It
guards an *act*, not a Command: `toggle-pump` is confirmed when starting and
unconfirmed when stopping, because only one direction is hazardous. An act that
*cannot* proceed is disabled rather than confirmed and then refused.
_Avoid_: modal, prompt, alert.

**Contracts**:
The shared wire types (`@hort/contracts`) used by both server and browser — the
snapshot, command bodies, entity kinds, reset-result union. Deliberately holds no
presentation metadata.

**Display metadata**:
Developer-authored labels, decimals and units for entity *types* — identical in
every deployment, shipped in the bundle, never in the server or contracts.
Operator-authored data such as a Zone name is not display metadata.

**Zone name**:
The operator's free-text name for a zone ("Olive terrace"). Domain data, not
display metadata: it is authored in the field, outlives any deploy, and must read
the same on every browser — so the server owns it.

**Zone name history**:
The append-only record of what each zone has been called, each entry valid from
the moment it was set. A watering event is labelled with the name in force when
it ran, not the name now — the controller is routinely offline for weeks, so
ingest time and run time are far apart.

**Reset eligibility**:
Whether a Total Water reset is currently allowed (`resetIneligibleReason`). The
server is the enforcing authority; the client keeps the same check only to dim
the affordance.

**Watering event**:
One completed pump-on span reported by the controller, which is the authoritative
source (see the controller glossary). The server does not detect events — it
ingests the controller's log and dedups by `(device_id, seq)`, storing the
device's wall-clock start/end, litres, outcome, trigger and zone in SQLite.
_Avoid_: irrigation run, cycle, watering session.

**Ingest**:
The server's one job for watering history: consume the retained `watering/log`,
insert any event with an unseen `(device_id, seq)`, store the device's values
verbatim. Not detection, not derivation.

**Last watering**:
The latest controller-ordered watering event that delivered water, regardless of
its outcome or trigger. Zero-litre dry runs do not count; wall-clock validity
does not determine which event is latest.
_Avoid_: last irrigation.

**Daily water delivered**:
The sum of litres from watering events whose end falls on one Europe/Madrid
calendar day. Every outcome contributes its delivered litres; zero-litre events
contribute nothing but remain errors when their outcome is not completed. The
heatmap shows this day total; the per-zone split is a breakdown of the same sum.
_Avoid_: watering frequency when referring to the heatmap.

**Schematic**:
The dashboard's diagram of the physical system — sources, pump, flow sensor and
zones, drawn left to right in the direction water flows. It is the control
surface, not an illustration: selecting a node acts on it and reveals its
settings in the adjacent info panel. It replaced the separate Relays and Flow
cards; the presentational component lives in `@hort/ui` and holds no state.

**Live route**:
The path from the open source through pump and flow sensor to the open zone,
drawn in `water` blue. It animates only while the pump is running and the path is
open — colour marks the route, movement marks that water is actually moving.

**Paper theme**:
The single shipped visual theme: restrained palette, flat surfaces, sharp
corners, no shadows or gradients, and motion only where movement carries
information. A deliberate aesthetic, not a hardware constraint. Governed by
[`packages/ui/DESIGN.md`](./packages/ui/DESIGN.md).
_Avoid_: e-ink theme.

**Semantic colour**:
A palette entry that means exactly one thing and is never decorative: `action`
(the one affirmative action), `warning` (a blocked precondition), `danger`
(harm, loss or failure), and `water` (the path water takes). The meaning must
also be readable without colour.

**Blocked precondition**:
A state the system refuses to leave because something the operator can change is
not yet true — the pump with no open path, a Total Water reset that is not yet
eligible. Nothing is broken and nothing is lost. Carries `warning`, and is told
apart from harm by one test: if the operator can clear it right now by acting on
the system, it is a blocked precondition and not a danger.
_Avoid_: error, fault, alarm.
