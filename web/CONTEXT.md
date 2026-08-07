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

**Contracts**:
The shared wire types (`@hort/contracts`) used by both server and browser — the
snapshot, command bodies, entity kinds, reset-result union. Deliberately holds no
presentation metadata.

**Display metadata**:
Labels, decimals and units — presentation only, kept client-side, never in the
server or contracts.

**Reset eligibility**:
Whether a Total Water reset is currently allowed (`resetIneligibleReason`). The
server is the enforcing authority; the client keeps the same check only to dim
the affordance.

**e-ink theme**:
The single shipped visual theme, driving the hard design constraints (no motion,
no rounded corners, no shadows, no gradients). Governed by
[`packages/ui/DESIGN.md`](./packages/ui/DESIGN.md).
