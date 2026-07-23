# Report: YF-B5 flow sensor implementation

## What changed

### `kc868-a8.yaml`

- **`globals:`** block added (before `script:`): `water_total_l` (persisted
  double, lifetime liter odometer), `pump_on_since_ms` (uint32_t, millis at
  pump start), `low_flow_secs` (int, confirm-window counter), `last_total_pulses`
  (double, delta guard for reboot resets).

- **Pump switch** (`id: pump`): `on_turn_on` automation added — stamps
  `pump_on_since_ms = millis()` and resets `low_flow_secs`.

- **`sensor:`** block — two entries added:
  - `pulse_counter` on GPIO13 (input + internal pullup), filtered `/ 396.0` →
    L/min, `id: flow_pulses`, `name: "Flow Rate"`. Its `total:` sub-sensor
    (`id: flow_total_pulses`, internal) accumulates deltas into
    `water_total_l` via `on_value` lambda with reboot-reset guard.
  - `template` sensor `id: total_water`, `name: "Total Water"`, returns
    `water_total_l`, updates every 5 s.

- **`interval:`** top-level block: 1 s tick. When pump is on and past the 15 s
  grace, increments `low_flow_secs` while flow < 0.5 L/min; resets it otherwise.
  At 3 s sustained low flow calls `abort_irrigation->execute()`,
  `ESP_LOGW("flow", ...)`, and `dry_run_publish->execute()`.

- **`script:`** — `dry_run_publish` helper script added: publishes
  `kc868-a8/flow/dry_run → "ON"` over MQTT (keeps `mqtt.publish` action out of
  the lambda where it cannot be called directly).

### `observability/telegraf/fertigation.conf` (new)

Telegraf `[[inputs.mqtt_consumer]]` fragment consuming
`kc868-a8/sensor/flow_rate/state` and `kc868-a8/sensor/total_water/state`.
`data_format = "value"`, `data_type = "float"`. Topic parsing extracts
`device` and `entity` tags. Writes to `esphome_sensor` measurement, inheriting
the main config's `[[outputs.influxdb_v2]]` via `--config-directory`.

### `observability/grafana/fertigation.json` (new)

Grafana 13 dashboard (uid `hort-fertigation`, title "Hort · Fertigation", tag
`hort`), datasource uid `influxdb-zigbee` (Flux). Three panels:
1. Flow rate — timeseries, unit L/min, `mean` aggregate.
2. Water used per period — bar chart (drawStyle bars), unit L, `max` +
   `difference(nonNegative: true)` on the monotonic total.
3. Lifetime total — stat panel, `last()`.

### `observability/justfile` (new)

`just deploy` copies both files to `../../homelab/automation/telegraf/telegraf.d/`
and `../../homelab/automation/grafana/dashboards-hort/`.

### `observability/README.md` (new)

Documents the source-of-truth/deploy pattern, `just deploy` usage, and the
three one-time homelab structural changes (Telegraf `--config-directory` volume
+ command override, Grafana `dashboards-hort` volume mount, second
`provider.yaml` entry) that a homelab-side agent must apply once.

### `dashboard/site/index.html`

New `<section class="card card-flow">` inserted before `card-env`. Contains an
SVG flow icon, heading "Flow", and a `<dl>` with:
- `<span id="val-flow_rate">` / L/min
- `<span id="val-total_water">` / L

### `dashboard/site/app.js`

`NUMERIC` map extended with `flow_rate: 1` and `total_water: 0`. No other JS
changes needed — the existing `setSensor` handler already routes
`sensor/<objectId>/state` to `val-<objectId>`.

## How verified

1. **ESPHome config validation** — `../my-esphome/.venv/bin/esphome config
   kc868-a8.yaml` returned `INFO Configuration is valid!` with no errors.

2. **Web dashboard** — `python3 -m http.server -d dashboard/site 18080`; `curl`
   of `http://localhost:18080/` confirmed `card-flow` section present,
   `val-flow_rate` and `val-total_water` spans present with correct units.

Hardware OTA flash and live log verification (pulse counts, odometer survival
across reboot, dry-run trip) require physical hardware and are not automated
here.

## Follow-ups

- **One-time homelab changes** (Telegraf volume/command, Grafana volume +
  provider): document-only here; a homelab-side agent must apply them to
  `../homelab/automation/docker-compose.yml` and
  `../homelab/automation/grafana/provisioning/dashboards/provider.yaml`.
- **OTA flash + live test**: after physical wiring, flash and observe
  `flow_rate` in ESPHome logs; confirm `total_water` persists across a reboot;
  simulate a dry run (pump on, hand over sensor) and verify `abort_irrigation`
  fires and `kc868-a8/flow/dry_run` is published.
- **Grafana datasource uid**: `influxdb-zigbee` is the provisioned datasource
  uid assumed from the homelab side. Verify it matches before importing the
  dashboard.
- **MQTT client_id collision**: `telegraf-esphome-sensor` must not duplicate an
  existing client_id in the broker; rename if needed.
