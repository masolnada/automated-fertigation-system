# Plan: YF-B5 flow sensor — dry-run pump cutoff, liter counter, MQTT→InfluxDB→Grafana

This plan is self-contained. You are implementing it in the repo
`automated-fertigation-system` (an ESPHome KC868-A8 fertigation controller).
The homelab repo is a sibling at `../homelab`.

## Goal & scope

Add a YF-B5 water flow sensor to the KC868-A8 controller to:

1. Stop the pump when no flow is detected (dry-run protection).
2. Count lifetime liters that have passed through the sensor.
3. Stream flow rate + lifetime total to InfluxDB via MQTT → Telegraf.
4. Visualize in Grafana.
5. Surface the readings on the field-facing e-ink web dashboard.

### Non-goals

- No per-run / per-day resettable counters in firmware — those are derived in
  Grafana from the lifetime total.
- Do NOT edit the homelab repo in place. The Telegraf/Grafana files live in THIS
  repo under `observability/` and are deployed with a `justfile`. The one-time
  homelab structural changes are only *documented* in `observability/README.md`.
- No flow-based control beyond the safety cutoff.
- Do not change the existing irrigation sequence logic.

## Facts already established (do not re-litigate)

- **Sensor:** YF-B5, brass, G1/2", range 1–30 L/min, ±3%. Output pulse
  `F = 6.6 * Q` (Q in L/min) ⇒ **396 pulses per liter**.
- **Wiring (user does this physically; you only write firmware + docs):**
  YF-B5 powered from **5 V**, common GND. Signal wire → **1 kΩ series / 2 kΩ to
  GND** resistor divider (5 V → ~3.3 V) → **GPIO13** (a free 1-Wire header on the
  KC868-A8; interrupt-capable, supports internal pull-up). Sensor is plumbed on
  the **pump-outlet common line, downstream of both valves**, so it sees flow in
  every phase.
- The 8 board digital inputs go through a PCF8574 I²C expander and CANNOT do
  pulse counting — the sensor must be on a real ESP32 GPIO (GPIO13).
- **InfluxDB is v2.9** (Flux, token/org/bucket). **Telegraf** bridges MQTT →
  InfluxDB. **Grafana 13** provisions dashboards from files. All in
  `../homelab/automation/`.
- ESPHome's `mqtt:` component auto-publishes every sensor to
  `kc868-a8/sensor/<object_id>/state` with a bare numeric payload. No extra
  firmware is needed to publish over MQTT.

## Safety-guard parameters (agreed)

- Guard is armed **whenever the pump is on** (not only during the sequence).
- **15 s grace** after each pump start (priming can take a while) before the
  guard can trip.
- After grace, trip if flow stays **< 0.5 L/min for a sustained 3 s** confirm
  window.
- Tripping calls the existing `abort_irrigation` script (the documented shared
  interrupt path) and publishes an MQTT event.

---

## Task 1 — Firmware changes in `kc868-a8.yaml`

Read the whole file first. Relevant existing anchors:

- `switch:` → `- platform: gpio` **Pump** (`id: pump`), near the top of the
  switch block.
- `script:` → `- id: abort_irrigation` (already the single shared interrupt
  path; the file's own comments anticipate "any future sensor ... all execute
  this").
- `sensor:` block (Victron + uptime + dallas_temp).
- `mqtt:` block at the end (broker, `on_message`). Existing publish example:
  the `battery_charged` binary sensor publishes to `kc868-a8/battery/charged`.

### 1a. Add a `globals:` block

Add a top-level `globals:` section (place it near the other top-level blocks,
e.g. just before `script:`):

```yaml
globals:
  # Persisted lifetime odometer, in liters. Survives the solar/night reboots.
  - id: water_total_l
    type: double
    restore_value: yes
    initial_value: "0"
  # millis() at the last pump turn-on; drives the 15 s priming grace.
  - id: pump_on_since_ms
    type: uint32_t
    restore_value: no
    initial_value: "0"
  # Consecutive seconds of low flow while armed; the 3 s confirm window.
  - id: low_flow_secs
    type: int
    restore_value: no
    initial_value: "0"
  # Last observed cumulative pulse count, to compute per-cycle deltas.
  - id: last_total_pulses
    type: double
    restore_value: no
    initial_value: "0"
```

### 1b. Add the flow sensors in `sensor:`

```yaml
  # YF-B5 flow sensor on GPIO13 via a 1k/2k divider. 396 pulses per liter.
  - platform: pulse_counter
    pin:
      number: GPIO13
      mode:
        input: true
        pullup: true
    id: flow_pulses
    name: "Flow Rate"
    unit_of_measurement: "L/min"
    accuracy_decimals: 2
    update_interval: 1s
    # pulse_counter reports pulses/min; 396 pulses = 1 L.
    filters:
      - lambda: return x / 396.0;
    total:
      id: flow_total_pulses
      internal: true
      # Accumulate the delta since the last update into the persisted total.
      on_value:
        - lambda: |-
            double delta = x - id(last_total_pulses);
            if (delta < 0) delta = x;      // counter reset (reboot) → treat x as delta
            id(last_total_pulses) = x;
            id(water_total_l) += delta / 396.0;

  # Persisted lifetime odometer exposed as its own sensor.
  - platform: template
    name: "Total Water"
    id: total_water
    unit_of_measurement: "L"
    accuracy_decimals: 1
    update_interval: 5s
    lambda: return id(water_total_l);
```

Confirm the resulting MQTT object_ids are `flow_rate` and `total_water`
(ESPHome slugifies "Flow Rate" → `flow_rate`, "Total Water" → `total_water`).
The web dashboard and Telegraf config below depend on exactly these ids.

### 1c. Stamp pump start time

On the existing **Pump** gpio switch, add an `on_turn_on` automation (keep the
existing `restore_mode`, `pin`, etc.):

```yaml
    on_turn_on:
      - lambda: |-
          id(pump_on_since_ms) = millis();
          id(low_flow_secs) = 0;
```

### 1d. Add the dry-run guard as a top-level `interval:`

```yaml
interval:
  # Dry-run protection: with the pump running past its priming grace, sustained
  # no-flow means the pump is not moving water — stop everything via the shared
  # abort path. 0.5 L/min is well under the sensor's 1 L/min floor, so real
  # irrigation never trips it.
  - interval: 1s
    then:
      - lambda: |-
          if (!id(pump).state) { id(low_flow_secs) = 0; return; }
          if (millis() - id(pump_on_since_ms) < 15000) { id(low_flow_secs) = 0; return; }
          if (isnan(id(flow_pulses).state)) return;
          if (id(flow_pulses).state < 0.5) {
            id(low_flow_secs)++;
          } else {
            id(low_flow_secs) = 0;
          }
          if (id(low_flow_secs) >= 3) {
            id(low_flow_secs) = 0;
            id(abort_irrigation)->execute();
            ESP_LOGW("flow", "dry-run detected: no flow with pump on, aborting");
            id(dry_run_publish)->execute();
          }
```

Add a tiny helper script (in the existing `script:` block) to publish the MQTT
event — keeps the `mqtt.publish` action out of the lambda:

```yaml
  - id: dry_run_publish
    then:
      - mqtt.publish:
          topic: kc868-a8/flow/dry_run
          payload: "ON"
```

> Note: `id(flow_pulses).state` holds the filtered value (L/min) because the
> filter is applied to the main sensor. Verify during logs testing.

### 1e. Validate

```bash
../my-esphome/.venv/bin/esphome config kc868-a8.yaml
```

---

## Task 2 — Observability artifacts (new `observability/` folder)

Create these files in THIS repo.

### 2a. `observability/telegraf/fertigation.conf`

A standalone Telegraf input fragment, loaded on the homelab side via
`--config-directory` (see README). It only defines an input; it reuses the main
`telegraf.conf`'s existing `[[outputs.influxdb_v2]]`. Mirror the style of the
existing `esphome_switch` block in `../homelab/automation/telegraf/telegraf.conf`.

```toml
# Fertigation controller (KC868-A8) flow sensor. ESPHome publishes bare numeric
# payloads to <device>/sensor/<entity>/state, so this uses the value parser as a
# float rather than the JSON parser used for zigbee/shelly. Reuses the main
# config's influxdb_v2 output (merged via --config-directory).
[[inputs.mqtt_consumer]]
  name_override = "esphome_sensor"
  servers = ["tcp://mosquitto:1883"]
  topics = [
    "kc868-a8/sensor/flow_rate/state",
    "kc868-a8/sensor/total_water/state",
  ]
  username = "${MQTT_USERNAME}"
  password = "${MQTT_PASSWORD}"
  client_id = "telegraf-esphome-sensor"
  qos = 0
  topic_tag = ""
  data_format = "value"
  data_type = "float"

  # kc868-a8/sensor/flow_rate/state
  #   → tags: device=kc868-a8, entity=flow_rate
  [[inputs.mqtt_consumer.topic_parsing]]
    topic = "+/+/+/+"
    tags = "device//entity/"
```

### 2b. `observability/grafana/fertigation.json`

A Grafana dashboard JSON (schema compatible with Grafana 13). Requirements:

- Datasource: InfluxDB, uid **`influxdb-zigbee`** (the provisioned datasource in
  homelab), query language **Flux**.
- Title: "Hort · Fertigation". Tag it e.g. `hort`.
- Panel 1 — **Flow rate** (timeseries, unit L/min):
  ```flux
  from(bucket: v.defaultBucket)
    |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
    |> filter(fn: (r) => r._measurement == "esphome_sensor")
    |> filter(fn: (r) => r.entity == "flow_rate" and r._field == "value")
    |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)
  ```
- Panel 2 — **Water used per period** (bar chart / timeseries bars, unit L),
  derived from the monotonic total:
  ```flux
  from(bucket: v.defaultBucket)
    |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
    |> filter(fn: (r) => r._measurement == "esphome_sensor")
    |> filter(fn: (r) => r.entity == "total_water" and r._field == "value")
    |> aggregateWindow(every: v.windowPeriod, fn: max, createEmpty: false)
    |> difference(nonNegative: true)
  ```
- Panel 3 — **Lifetime total** (stat, unit L):
  ```flux
  from(bucket: v.defaultBucket)
    |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
    |> filter(fn: (r) => r._measurement == "esphome_sensor")
    |> filter(fn: (r) => r.entity == "total_water" and r._field == "value")
    |> last()
  ```

If `v.defaultBucket` is not available in the panel context, fall back to the
datasource's default bucket (the provisioned datasource sets `defaultBucket`).

### 2c. `observability/justfile`

Recipes run from the `observability/` directory; homelab is two levels up.

```just
homelab := "../../homelab/automation"

# Copy Telegraf + Grafana artifacts into the homelab repo.
deploy: deploy-telegraf deploy-grafana

deploy-telegraf:
    mkdir -p {{homelab}}/telegraf/telegraf.d
    cp telegraf/fertigation.conf {{homelab}}/telegraf/telegraf.d/fertigation.conf

deploy-grafana:
    mkdir -p {{homelab}}/grafana/dashboards-hort
    cp grafana/fertigation.json {{homelab}}/grafana/dashboards-hort/fertigation.json
```

### 2d. `observability/README.md`

Write for another agent with no context. Cover:

- What these files are and why they live here (source of truth) but deploy to
  homelab.
- `just deploy` (or `just --justfile observability/justfile deploy`).
- The **one-time homelab structural changes** the `just` copy does NOT perform,
  which a homelab-side agent must apply once in
  `../homelab/automation/docker-compose.yml` and
  `../homelab/automation/grafana/provisioning/dashboards/provider.yaml`:

  1. **Telegraf** service: add volume
     `./telegraf/telegraf.d:/etc/telegraf/telegraf.d:ro` and set
     `command: telegraf --config /etc/telegraf/telegraf.conf --config-directory /etc/telegraf/telegraf.d`
     so the fragment is loaded alongside the main config.
  2. **Grafana** service: add volume
     `./grafana/dashboards-hort:/var/lib/grafana/dashboards-hort:ro`
     (a SEPARATE directory, non-overlapping with the existing
     `./grafana/dashboards` mount — the existing file provider scans
     recursively, so a nested dir would be double-loaded and conflict).
  3. **provider.yaml**: append a second provider:
     ```yaml
       - name: hort
         folder: Hort
         type: file
         disableDeletion: false
         updateIntervalSeconds: 30
         allowUiUpdates: true
         options:
           path: /var/lib/grafana/dashboards-hort
           foldersFromFilesStructure: false
     ```
- Note the MQTT topics consumed (`kc868-a8/sensor/flow_rate/state`,
  `kc868-a8/sensor/total_water/state`) and the `esphome_sensor` measurement /
  `device`,`entity` tags produced.

---

## Task 3 — Field e-ink web dashboard (`dashboard/site/`)

Follow `dashboard/DESIGN.md` strictly: monochrome black-and-white, no color, no
animation/transitions, sharp 90° corners, thick black borders / dashed dividers.

### 3a. `dashboard/site/index.html`

Add a new **Flow** card in `<main>` (mirror the structure of the existing
`card-env` / `card-battery` cards, which use a `<dl>` with
`<dt>`/`<dd><span id="val-...">`). Use a suitable inline SVG icon consistent with
the others. The two value spans MUST be:

```html
<div><dt>Flow rate</dt><dd><span id="val-flow_rate">–</span><i>L/min</i></dd></div>
<div><dt>Total water</dt><dd><span id="val-total_water">–</span><i>L</i></dd></div>
```

### 3b. `dashboard/site/app.js`

In the `NUMERIC` map (around `app.js:24`) add:

```js
    flow_rate: 1,
    total_water: 0,
```

No other JS change is needed — the existing `client.on("message", ...)` handler
already routes `sensor/<objectId>/state` through `setSensor`, which writes to
`val-<objectId>`.

### 3c. Verify the web page

```bash
cp dashboard/site/config.js.template dashboard/site/config.js   # fill dummy values
python3 -m http.server -d dashboard/site 8080
```

Load `http://localhost:8080`, confirm the Flow card renders in the e-ink style.
(Live values require the broker; rendering + no console errors is enough here.)

---

## Overall verification checklist

1. `../my-esphome/.venv/bin/esphome config kc868-a8.yaml` passes.
2. (If hardware available) OTA flash and
   `../my-esphome/.venv/bin/esphome logs kc868-a8.yaml --device kc868-a8.local`:
   - pulse counts appear on `flow_rate`; `total_water` increments and survives a
     reboot;
   - with the pump on and no flow for >15 s, `abort_irrigation` fires and
     `kc868-a8/flow/dry_run` is published.
3. `just --justfile observability/justfile deploy` copies both files to the
   homelab paths without error.
4. Web dashboard renders the Flow card (Task 3c).

## Risks / edge cases (already resolved — just implement)

- 5 V logic vs 3.3 V pin → resistor divider (hardware).
- False trip below the sensor's 1 L/min floor → 0.5 L/min threshold + 15 s grace
  + 3 s confirm; pump on the common line runs well above 1 L/min.
- Flash wear from persisting the total → ESPHome global restore flushes at most
  once/60 s and only on change.
- Grafana double-loading the dashboard → separate `dashboards-hort` directory,
  non-overlapping with the existing recursive provider.
- Reboot resetting the counter → `restore_value: yes` global; the `total`
  `on_value` handles the per-boot counter reset (delta guard).

## Deliverables

- Modified `kc868-a8.yaml`.
- New `observability/{telegraf/fertigation.conf, grafana/fertigation.json,
  justfile, README.md}`.
- Modified `dashboard/site/index.html`, `dashboard/site/app.js`.
- On completion write `report.md` in this task folder (what changed, how
  verified, follow-ups). If blocked, write `blockers.md` and stop.
