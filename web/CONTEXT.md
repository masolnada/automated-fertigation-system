# Web

The operator-facing side of the system (`web/`): a React dashboard and the server
that fronts the device. The browser never speaks to the device directly — the
server owns MQTT and the browser talks to the server.

## Language

**Snapshot**:
The complete current state of the controller as the server sees it — entity
values, valve positions, the zone registry and assignation table, reset-pending
flag, and the rolling event log. The unit of truth pushed to the browser; one
snapshot per change.
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
the pump, starting irrigation, resetting Total Water, and archiving a zone. It
guards an *act*, not a Command: `toggle-pump` is confirmed when starting and
unconfirmed when stopping, because only one direction is hazardous. An act that
*cannot* proceed is disabled rather than confirmed and then refused. Archiving
qualifies not because it is hazardous but because its consequence is invisible in
the click: it also clears the zone's channel assignment. It restates every
consequential input to the act, so starting an irrigation names the zone and
channel about to be watered — a dialog that does not say what it is confirming is
a speed bump, not a check.
_Avoid_: modal, prompt, alert.

**Contracts**:
The shared wire types (`@hort/contracts`) used by both server and browser — the
snapshot, command bodies, entity kinds, reset-result union. Deliberately holds no
presentation metadata.

**Display metadata**:
Developer-authored labels, decimals and units for entity *types* — identical in
every deployment, shipped in the bundle, never in the server or contracts.
Operator-authored data such as a Zone name is not display metadata.

**Output channel**:
A numbered downstream valve on the controller. The server's word for the same
thing the firmware means: a relay, with no notion of what it waters. Four of
them, hardware-fixed (controller ADR-0015). Which channel an irrigation waters is
an input to that run, carried on `start-irrigation` and required there; the
channel the *Schematic* opens is a separate act, and the two can disagree until
the run starts.

A server-side and wire-level term, not an operator-facing one: the dashboard
names zones, and says "Output N" only where a channel has no zone to name and in
the assignation editor, whose whole job is to relate the two (ADR-0016).
_Avoid_: zone — a channel is not a place.

**Zone**:
A place that gets watered ("Olive terrace"). Exists only on the server,
identified by a UUID so it survives both renaming and being re-plumbed onto a
different output channel. Domain data, not display metadata: authored in the
field, outlives any deploy, and must read the same on every browser.

The operator's unit throughout the dashboard: what they pick before starting an
irrigation, what the Confirmation names, and what the history is scoped by. They
act on zones and the channel underneath stays the firmware's business — which is
why an act on a zone is still, underneath, an act on the channel assigned to it
(ADR-0016).

**Zone name**:
The operator's free-text label for a zone. **Current-only**: renaming relabels
that zone's whole history, because it is the same place under a new name
(ADR-0015). When the *place* changed rather than the name, the act is
archive-and-create, not rename.

**Assignation table**:
Which zone each output channel feeds. One-to-one in both directions, and
append-only with a `valid_from`, so a watering event resolves to the zone that
was on its channel *when it ran* — the controller is offline for weeks, so
resolving against the current table would file old water against whatever the
channel feeds now. Edited and saved as a whole, since one-to-one is a property of
the table rather than of any row.
_Avoid_: mapping, routing.

**Archived zone**:
A zone taken out of the selectable list with everything it ever watered
preserved — archiving is bookkeeping, not deletion. It also clears the zone's
channel assignment, so a current assignment always points at a live zone.
Restoring brings the zone back but not the assignment.

**Reset eligibility**:
Whether a Total Water reset is currently allowed (`resetIneligibleReason`). The
server is the enforcing authority; the client keeps the same check only to dim
the affordance.

**Watering event**:
One completed pump-on span reported by the controller, which is the authoritative
source (see the controller glossary). The server does not detect events — it
ingests the controller's log and dedups by `(device_id, seq)`, storing the
device's wall-clock start/end, litres, outcome, trigger and *output channel* in
SQLite. Its zone is resolved through the assignation table, not stored.
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
Water from an unassigned channel is counted and shown under that channel, since
it really was delivered — it simply went somewhere unnamed.
_Avoid_: watering frequency when referring to the heatmap.

**Schematic**:
The dashboard's diagram of the physical system — sources, pump, flow sensor and
output channels, drawn left to right in the direction water flows. It is the
control surface, not an illustration: selecting a node acts on it, and anything
it needs to say opens as a modal rather than an adjacent panel. Each output
channel is labelled with the zone assigned to it, or with the bare channel when
nothing is. The presentational component lives in `@hort/ui` and holds no state.

**Live route**:
The path from the open source through pump and flow sensor to the open output
channel, drawn in `water` blue. It animates only while the pump is running and
the path is open — colour marks the route, movement marks that water is actually
moving.

**Paper theme**:
The dashboard's design language: restrained palette, flat surfaces, sharp
corners, no shadows or gradients, and motion only where movement carries
information. A deliberate aesthetic, not a hardware constraint. Names the
language, not the colour of the page — it ships in two substrates. Governed by
[`packages/ui/DESIGN.md`](./packages/ui/DESIGN.md).
_Avoid_: e-ink theme, light theme.

**Substrate**:
Which way round the page is drawn — **Light** (dark ink on a light page) or
**Dark** (light ink on a dark page). Dark is a mode of the Paper theme, not a
second theme: the design language is identical in both and only the substrate
inverts. Chosen by the operator per browser and remembered there; the system
setting seeds only a browser's first visit and never overrides the choice
afterwards.
_Avoid_: dark theme, colour scheme.

**Ink** / **Paper**:
Foreground and substrate as *roles*, not colours: `ink` is whatever the page is
written in and `paper` whatever it is written on, so both swap in Dark. Every
fill inverts with them, so a label on a fill is always one or the other — `ink`
when the fill sits near the page, `paper` when it sits opposite.
_Avoid_: black, white.

**Semantic colour**:
A palette entry that means exactly one thing and is never decorative: `action`
(the one affirmative action), `connected` (a live connection in the header
status strip), `warning` (a blocked precondition), `danger` (harm, loss or
failure), and `water` (the path water takes). Two entries may share a value and
still be two entries — `action` and `connected` are both green but behave
differently across substrates. The meaning must
also be readable without colour. One meaning, one entry — an entry may still be
rendered in two values, one per substrate, where a single value would either be
illegible on one of them or carry the wrong loudness there.

**Blocked precondition**:
A state the system refuses to leave because something the operator can change is
not yet true — the pump with no open path, a Total Water reset that is not yet
eligible, an assignation edit while the pump runs. Nothing is broken and nothing
is lost. Carries `warning`, and is told
apart from harm by one test: if the operator can clear it right now by acting on
the system, it is a blocked precondition and not a danger.
_Avoid_: error, fault, alarm.
