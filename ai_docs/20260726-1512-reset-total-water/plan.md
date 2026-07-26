# Plan: Reset total water, custom dashboard dialogs, and MQTT warning observability

This plan is the approved source of truth for implementation in
`automated-fertigation-system`.

## Goal

Allow the persisted `Total Water` counter to be safely reset to zero from both:

1. the native ESPHome web interface; and
2. the custom dashboard under `dashboard/site/`.

Also improve the custom dashboard confirmation UX, add a tightly scoped danger
colour to the design system, and expose MQTT-originated warnings/errors in the
Grafana dashboard. `Total Water` will mean **cumulative water since the last
reset**, not a lifetime odometer.

## User-approved decisions

- Reset is available in both native ESPHome and the custom dashboard.
- Firmware rejects reset when:
  - the pump is running;
  - flow is unavailable/NaN;
  - flow is `>= 0.1 L/min`.
- Reset must survive an immediate reboot/power loss before success is reported.
- The new zero state is published immediately after a successful reset.
- MQTT reset results are transient/non-retained.
- Result states are:
  - `success`;
  - `already_zero`;
  - `rejected_pump_running`;
  - `rejected_flow_active`;
  - `rejected_flow_unknown`;
  - `error_persistence`.
- The dashboard reset action is hidden behind a reusable three-dot card menu in
  the Flow card, not presented as a prominent face-level button.
- Reset is disabled in the dashboard unless broker and device are online, pump
  and flow state are known and safe, and Total Water is a valid value greater
  than zero. Firmware remains authoritative against stale UI state.
- The reset dialog shows the current total, explains that reset is irreversible,
  and uses a 10-second response timeout.
- On success, close the dialog. On rejection/error/timeout, keep it open and
  show the reason.
- Replace every existing browser `confirm()` with the same reusable custom
  dialog framework.
- Escape/backdrop cancellation, click-outside card-menu dismissal, and focus
  restoration are required.
- Total Water displays with one decimal in the custom dashboard.
- Add danger red `#B00020` for warnings, errors, offline states, and destructive
  actions. No other colour expansion is allowed.
- `dashboard/DESIGN.md` is the sole source of truth for dashboard visual rules.
  Simplify `CLAUDE.md` to reference it without duplicating colour/style rules.
- Grafana must only show MQTT-originated warning/error events, never browser-only
  dashboard errors.
- Grafana severity mapping:
  - error: dry-run shutdown, reset persistence failure, device offline;
  - warning: reset rejected for pump running, active flow, or unknown flow.
  - no info events; successful reset, already-zero, and online recovery are not
    displayed in the warning/error table.
- Grafana gets an interval selector with `Auto` default and options:
  `1m`, `5m`, `15m`, `1h`, `6h`, `12h`, `1d`, `7d`.
- Aggregated usage is shown as bars titled `Water used per interval`.
- The errors/warnings table follows the selected Grafana time range and sorts
  newest first.
- No reset annotations or extra reset-event audit pipeline are required.

## Non-goals

- Do not add a backend to the static dashboard.
- Do not ingest browser connection errors into InfluxDB/Grafana.
- Do not change irrigation sequence behaviour, flow calibration, dry-run safety
  thresholds, relay behaviour, or hardware wiring.
- Do not alter historical Grafana data. Counter resets must be handled by the
  query.
- Do not expose a permanent reset-status entity in the native ESPHome UI.
- Do not add another colour beyond the existing black/white/permitted divider
  gray and the single danger red.
- Do not edit `dashboard/site/config.js`; it is local, gitignored configuration.

## Current implementation facts

- `water_total_l` is a restoring global in `kc868-a8.yaml`; it survives reboot.
- `flow_total_pulses` adds pulse deltas into `water_total_l`.
- The `total_water` template sensor reads the global every 5 seconds and is
  auto-published by ESPHome MQTT to
  `kc868-a8/sensor/total_water/state`.
- The custom dashboard subscribes to `kc868-a8/#` and renders matching sensor
  topics.
- Existing custom MQTT events include `kc868-a8/flow/dry_run`; ESPHome device
  availability is `kc868-a8/status`.
- ESPHome version available for validation is 2025.11.4 at
  `../my-esphome/.venv/bin/esphome`.
- Restoring globals stage changes through ESPHome preferences before the normal
  preference sync interval. A successful reset must explicitly ensure the zero
  has been staged and `global_preferences->sync()` has succeeded before
  publishing `success`; do not globally set flash writes to immediate because
  the flow total changes frequently and that would cause excessive flash wear.

---

## Task 1: Firmware reset flow (`kc868-a8.yaml`)

### 1.1 Shared reset automation

Add one shared firmware reset path used by both the native template button and
MQTT request handling. Keep all safety decisions device-side.

Recommended IDs/topics:

- script/action ID: `reset_total_water`;
- request topic: `kc868-a8/flow/reset_total/request`;
- result topic: `kc868-a8/flow/reset_total/result`.

The request payload may be ignored, matching the existing irrigation request
style. Result publishes must explicitly use `retain: false`.

The reset path must evaluate in this order and publish/log exactly one result:

1. Pump ON -> `rejected_pump_running`.
2. Flow state NaN/unavailable -> `rejected_flow_unknown`.
3. Flow state `>= 0.1 L/min` -> `rejected_flow_active`.
4. Total already zero (use a safe floating comparison) -> `already_zero`, with
   no preference write.
5. Otherwise reset:
   - assign `water_total_l = 0`;
   - ensure the restoring global has had an ESPHome scheduler/component loop
     opportunity to stage the changed value into preferences;
   - call `global_preferences->sync()` and retain its boolean outcome;
   - only on successful sync, publish the `total_water` template sensor state as
     `0.0` immediately, log success, then publish `success`;
   - on sync failure, log an error and publish `error_persistence`, never
     `success`. Publish the current template-sensor state consistently so the UI
     does not silently disagree with RAM. Document in code that the zero may not
     survive reboot after this error.

Use a non-restoring boolean/global only if needed to carry persistence status
between YAML automation actions. Do not change the global preferences flash
write interval.

### 1.2 Native ESPHome interface

Add a template button named `Reset Total Water` that executes the shared reset
path. It acts immediately in the native web UI; the firmware guards prevent an
unsafe reset. Do not add a permanent status sensor/entity.

### 1.3 MQTT request

Add an `mqtt.on_message` handler for
`kc868-a8/flow/reset_total/request` that executes the same reset path. Do not
duplicate reset logic in the MQTT handler.

### 1.4 Logging

Use clear ESPHome logs for success, already-zero, each rejection, and persistence
failure. Rejections are warnings; persistence failure is an error.

---

## Task 2: Custom dashboard interaction (`dashboard/site/`)

All UI must follow the updated `dashboard/DESIGN.md`: sharp corners, no
animation/transitions, thick borders, e-ink-friendly geometry, and only the
approved palette.

### 2.1 Reusable card menu

Add a reusable card-menu pattern/component, initially used only in the Flow card.

- A three-dot/overflow trigger sits in the Flow card heading.
- Menu contains `Reset total water`.
- Menu is sharp, monochrome except permitted danger semantics, and has no
  animation.
- It closes on Escape, click outside, or selection, and restores focus.
- Use semantic buttons and correct ARIA (`aria-haspopup`, `aria-expanded`, menu
  relationship/labeling as appropriate).
- A disabled reset item remains understandable: expose a concise reason such as
  offline, waiting for state, pump running, active flow, unknown flow, or already
  zero. Do not rely on colour alone.

### 2.2 Reset eligibility state

Track explicit known/unknown state; do not treat missing MQTT state as OFF/zero.
Reset is enabled only when all are true:

- MQTT broker connected;
- device availability is online;
- pump state has been received and is OFF;
- flow state has been received, is finite, and is `< 0.1 L/min`;
- Total Water has been received, is finite, and is greater than zero;
- no reset request is already pending.

Re-evaluate eligibility while the menu or dialog is open. If conditions become
unsafe, disable confirmation. The ESP guard remains authoritative.

### 2.3 Reusable custom dialog

Implement one reusable in-page confirmation dialog and remove all browser
`confirm()` calls.

Use it for:

- Start irrigation;
- Toggle pump;
- Reset total water.

Requirements:

- styled entirely by project CSS, not browser confirm UI;
- accessible title/message/actions;
- Escape and backdrop cancel;
- focus trapped/managed appropriately and returned to the opener;
- no animation;
- supports normal and danger confirmation actions;
- Start and Pump retain their current command semantics; this task changes only
  confirmation presentation, not relay/control behaviour.

Reset copy should be equivalent to:

- title: `Reset total water?`
- body: `This will reset the total from 123.4 L to 0 L. This action cannot be undone.`
- actions: `Cancel`, `Reset total`.

### 2.4 Asynchronous reset result handling

On reset confirmation:

- re-check UI prerequisites;
- publish a non-retained request to
  `kc868-a8/flow/reset_total/request`;
- disable dialog actions and show static text `Waiting for device…`;
- start a 10-second timeout.

Handle transient results from `kc868-a8/flow/reset_total/result`:

- `success`: add a normal event, close dialog, restore focus;
- `already_zero`: add a normal event and resolve cleanly;
- rejection payloads: add a danger event, keep dialog open, restore actions, and
  replace/show the body reason in danger styling;
- `error_persistence`: add a danger event, keep dialog open, and clearly warn
  that zero may not survive reboot;
- unknown payload: treat as an error without crashing;
- timeout: keep dialog open, restore actions, and show
  `No response from device. Check its connection and current total before retrying.`

Clear timers safely when the dialog closes or a result arrives. Avoid duplicate
requests while pending.

### 2.5 Existing MQTT event handling

Extend the dashboard message handler to recognize
`kc868-a8/flow/dry_run` and add a danger event. Existing device offline and
broker error/offline presentation should use danger styling. These browser-side
entries remain local only and are not sent to Grafana.

Evolve `log()` to support at least normal and danger severity while preserving
timestamps and the existing bounded event count.

### 2.6 Display precision

Change custom-dashboard `total_water` rendering from zero decimals to one decimal
so it matches the ESPHome sensor and reset-dialog value.

---

## Task 3: Design-system source of truth

### 3.1 `dashboard/DESIGN.md`

Update the design system to permit exactly one semantic colour:

- `Danger Red: #B00020`.

Define its allowed uses:

- warnings and errors;
- offline states;
- destructive controls/actions;
- danger dialog messages and danger event rows.

Require sufficient non-colour cues (labels, border/fill, text) and preserve all
other e-ink constraints: no animation, no gradients, no shadows, no rounded
corners, no decorative colour.

### 3.2 `CLAUDE.md`

Make `dashboard/DESIGN.md` the only source of truth. Keep a concise instruction
that all `dashboard/site/` work must follow that document, but remove duplicated
claims about exact palette, colour prohibition, geometry, borders, and similar
visual details that could drift or contradict the design document.

### 3.3 CSS

Add `--danger: #B00020` and use it consistently for:

- offline badges;
- destructive `.danger` controls including Stop and Reset confirmation;
- rejected/error event rows;
- dialog error/rejection text;
- other warning/error states explicitly permitted by the design document.

Keep white text on filled danger buttons where needed for contrast. Do not use
red as decoration or for ordinary active states.

---

## Task 4: MQTT warning/error ingestion (`observability/`)

### 4.1 Telegraf

Extend `observability/telegraf/fertigation.conf` with a separate MQTT consumer
for event/status strings. Keep the existing numeric sensor consumer unchanged
except where comments need updated terminology.

Consume:

- `kc868-a8/flow/dry_run`;
- `kc868-a8/flow/reset_total/result`;
- `kc868-a8/status`.

Use a distinct MQTT client ID and a string value parser. Preserve the source MQTT
topic as a tag so Flux can classify records. Successful reset, already-zero,
and online status may be ingested as raw source records if filtering at ingestion
would add unnecessary complexity, but the Grafana warning/error view MUST filter
them out. Do not ingest browser-only events.

Update `observability/README.md` with the new topics, measurement/fields/tags, and
severity mapping.

### 4.2 Grafana interval variable

Update `observability/grafana/fertigation.json` with a custom interval variable,
e.g. `water_interval`:

- default: `Auto`;
- options: `Auto`, `1m`, `5m`, `15m`, `1h`, `6h`, `12h`, `1d`, `7d`.

Ensure the Flux query resolves `Auto` to `v.windowPeriod` and manual values to a
valid Flux duration.

### 4.3 Correct usage aggregation

Update the water-usage query to calculate positive changes from the raw
cumulative `total_water` series first, then sum those changes into the selected
interval. The reset drop must not become negative usage and must not prevent
subsequent post-reset usage from being counted.

Conceptually:

1. filter `total_water` values;
2. sort as needed;
3. `difference(nonNegative: true)` on raw samples;
4. `aggregateWindow(..., fn: sum, createEmpty: false)` using the selected
   interval.

Title the bar panel `Water used per interval`, retain litres as the unit, and
keep bars as the visualization.

Rename `Lifetime total` to `Total since reset` and update any descriptions.

### 4.4 Errors and warnings table

Add a Grafana table titled `Errors and warnings` that:

- follows `v.timeRangeStart` / `v.timeRangeStop`;
- sorts newest first;
- shows timestamp, severity, event, and reason/details;
- displays only:
  - error: `flow/dry_run` event;
  - error: reset result `error_persistence`;
  - error: device status `offline`;
  - warning: reset results `rejected_pump_running`,
    `rejected_flow_active`, `rejected_flow_unknown`;
- excludes `success`, `already_zero`, and `online`.

Use Grafana field overrides/threshold colouring so errors are clearly red and
warnings visibly distinct, without changing the custom dashboard design system.
Do not add reset annotations.

---

## Task 5: Documentation consistency

Update relevant wording in:

- `README.md`;
- `docs/flow-sensor.md`;
- `dashboard/README.md` if controls/event behaviour warrants it;
- `observability/README.md`;
- comments in `kc868-a8.yaml` and Grafana panel descriptions.

Required terminology:

- `Total Water` = cumulative litres since the last reset;
- it persists across normal reboots;
- reset is guarded by pump/flow state and explicitly persisted;
- native ESPHome reset is immediate when safety checks pass;
- custom dashboard reset is under the Flow card menu with confirmation;
- document reset request/result MQTT topics and payloads;
- Grafana usage aggregation tolerates resets.

Remove stale references to a strictly lifetime/monotonic odometer where they are
no longer true.

---

## Verification

Run and report all feasible checks:

1. ESPHome validation:
   ```bash
   ../my-esphome/.venv/bin/esphome config kc868-a8.yaml
   ```
2. JavaScript syntax:
   ```bash
   node --check dashboard/site/app.js
   ```
3. Confirm browser dialogs are gone:
   ```bash
   rg -n 'confirm\\(' dashboard/site
   ```
   Expected: no matches.
4. HTML diagnostics with available `tidy`; distinguish pre-existing stylistic
   warnings from introduced structural errors.
5. Parse Grafana JSON with Python/`jq` and inspect that the variable, corrected
   usage query, and event table exist.
6. Validate Telegraf syntax as far as local tooling permits; if Telegraf is not
   installed, state that limitation and inspect TOML structurally.
7. `git diff --check`.
8. Review generated ESPHome config/code or compiler output as needed to verify:
   - native reset button exists;
   - request/result topics are correct;
   - result publishes are non-retained;
   - zero is staged before preference sync;
   - success is only published after successful sync;
   - immediate template sensor publish occurs.

If hardware/broker access is available, additionally test:

- safe reset from native UI and custom dashboard;
- all rejection paths;
- immediate `0.0` sensor state;
- reset survives immediate reboot;
- result timeout/error UI;
- dry-run event handling;
- Telegraf event ingestion and Grafana table/query behaviour.

Do not claim hardware/live MQTT verification if it was not performed.

## Deliverables

Expected modified files include:

- `kc868-a8.yaml`
- `CLAUDE.md`
- `README.md`
- `docs/flow-sensor.md`
- `dashboard/DESIGN.md`
- `dashboard/site/index.html`
- `dashboard/site/style.css`
- `dashboard/site/app.js`
- `dashboard/README.md` if needed
- `observability/telegraf/fertigation.conf`
- `observability/grafana/fertigation.json`
- `observability/README.md`

Developer must write `report.md` in this task folder on completion. If blocked,
write `blockers.md` and stop. Do not modify this approved `plan.md`.
