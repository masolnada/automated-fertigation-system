# Implementation plan — Soil Node

This is the executable plan for building the node. It assumes the design in
[`README.md`](README.md) and the decisions in [`adr/`](adr/) are settled; if a
decision is revisited, write a new ADR rather than editing this file.

Work in phases. **Each phase ends with something verifiable.** Do not start the
PCB before the breadboard proves the measurement, and do not deploy before the
link is proven at range.

## Open items to resolve first

These are known gaps in the design, listed before the work because two of them
can force a board respin if discovered late.

### 1. Verify the KC868-A8 pinout on the actual board

[ADR-0015](adr/0015-reclaim-gpio13-on-gateway.md) assumes v1.7 matches the
published KinCony pinout. **Continuity-check** from the S3/S4 header and the
unpopulated 433 MHz header to the ESP32 module pins before soldering the radio.

Expected: S3 → GPIO32, S4 → GPIO33, 433 TX pad → GPIO2, 433 RX pad → GPIO15.

If they differ, reassign — but keep the constraint that **CS must not land on a
strapping pin**, because it idles high.

### 2. Confirm the ADS1115 actually idles at ~2 µA under ESPHome

The power budget assumes single-shot mode with the ADC returning to its
power-down state between conversions. If ESPHome's `ads1115` component leaves it
in continuous conversion mode, it draws ~150 µA — **ten times the entire sleep
budget**, and battery life drops from years to weeks.

Measure it. If it free-runs, the fallback is powering the ADS1115 from a GPIO
(it draws well under the 40 mA pin limit) and bringing it up only during the
reading window. **Decide this before PCB layout**, since it changes the
schematic.

### 3. Resolve the GPIO18 conflict on the node

The netlist in `README.md` currently lists the battery-sense MOSFET gate on
GPIO18, which is also USB D−. That conflicts with the USB programming interface
([ADR-0005](adr/0005-esp32-c3-bare-module.md)), and there is no OTA to fall back
on.

Options: move the gate to a pin freed by consolidating elsewhere, or drive the
divider from an ADS1115 comparator pin, or accept a permanently connected
higher-value divider (10 MΩ/4.7 MΩ draws ~0.4 µA — about 3 % of the sleep
budget, which may be an acceptable simplification).

**Resolve during schematic capture.**

### 4. Choose the Rx value against the real sensors

10 kΩ is the reasoned starting point ([ADR-0007](adr/0007-h-bridge-divider-per-sensor.md)).
Confirm it in phase 1 by sweeping known resistors across 500 Ω – 35 kΩ and
checking that ADC resolution is adequate at both extremes.

## Phase 1 — Breadboard the measurement

**Goal: prove that resistance is measured correctly before committing to copper.**

1. Wire one H-bridge divider on a breadboard: any ESP32-C3 dev board (parasitic
   current does not matter yet), ADS1115, 10 kΩ 0.1 % resistor.
2. Substitute **precision resistors for the sensor** — 560 Ω, 1 k, 2.2 k, 4.7 k,
   10 k, 22 k, 33 k. These stand in for known soil tensions.
3. Write a throwaway ESPHome config that drives both directions and logs `V1`,
   `V2`, `Rs_A`, `Rs_B` and the averaged `Rs`.
4. **Verify:** measured `Rs` is within ~1 % of each known resistor across the
   whole range, and `Rs_A` and `Rs_B` agree closely. A large asymmetry between
   directions indicates a wiring or timing error.
5. Add the second channel and confirm the two are independent: with one channel
   excited, the other's junction must read nothing while its pins are high-Z.
6. Connect a real Watermark sensor. Soak it in water — expect close to 550 Ω.
   Let it dry — watch resistance climb.

**Do not proceed until step 4 passes.** Everything downstream assumes this
measurement is sound.

## Phase 2 — Prove the LoRa link

**Goal: confirm the two ends talk before either is permanently installed.**

1. On the breadboard node, add the SX1276 and a minimal `packet_transport`
   provider sending one dummy sensor.
2. On the A8, add `spi:`, `sx127x:` and `packet_transport` as consumer with the
   pin assignment from [ADR-0015](adr/0015-reclaim-gpio13-on-gateway.md), having
   first removed the `one_wire:` and `dallas_temp` blocks.
3. Validate both configs:
   ```bash
   ../my-esphome/.venv/bin/esphome config controller/kc868-a8.yaml
   ../my-esphome/.venv/bin/esphome config soil-node/soil-node.yaml
   ```
4. **Verify on the bench, side by side first:** the value appears in the A8 log
   and in its web UI. Check RSSI and SNR are logged.
5. **Then verify at the real installation distance**, with the intended
   antennas at the intended heights. Record RSSI. If it is worse than about
   −115 dBm, fix antenna placement before considering a higher spreading factor
   ([ADR-0011](adr/0011-lora-radio-parameters.md)).
6. Add the encryption key and rolling code
   ([ADR-0016](adr/0016-packet-transport-security.md)) and confirm the link
   still works. **Test the failure mode too:** change the key on one side only
   and confirm the gateway goes silent rather than accepting anything.

## Phase 3 — Complete the node firmware

Write `soil-node/soil-node.yaml` implementing the full design.

Structure:

- `esp32:` variant `esp32c3`, framework `esp-idf` (lower power and smaller than
  Arduino).
- **No `wifi:`, no `api:`, no `web_server:`, no `ota:`** — every one of these
  keeps a radio or a service alive
  ([ADR-0002](adr/0002-lora-only-topology.md)). This is deliberate and is the
  single biggest firmware-side power decision.
- `logger:` over USB serial only, at a level that does not slow the wake cycle.
- `deep_sleep:` with `sleep_duration: 30min`
  ([ADR-0012](adr/0012-thirty-minute-interval.md)) and a `run_duration` cap as a
  safety net so a hung sensor cannot hold the node awake and flatten the battery.
- `i2c:` for the ADS1115; `one_wire:` for the DS18B20.
- `spi:` and `sx127x:` with the parameters from
  [ADR-0011](adr/0011-lora-radio-parameters.md).
- `packet_transport:` as provider, with `encryption` and
  `rolling_code_enable: true`.
- Template sensors for the six transmitted values: `soil_1_resistance`,
  `soil_1_kpa`, `soil_2_resistance`, `soil_2_kpa`, `soil_temperature`,
  `battery_voltage`.

Wake sequence, as a script:

1. Read the DS18B20 (~750 ms). If it fails or reads outside −20 to +60 °C, fall
   back to 24 °C and flag it ([ADR-0008](adr/0008-ds18b20-soil-temperature.md)).
2. Sensor 1: pins to OUTPUT, direction 1, convert; direction 2, convert; pins to
   INPUT. Compute `Rs`.
3. Sensor 2: identical.
4. Gate the battery divider on, convert, gate off.
5. Apply the piecewise conversion including the 240/255 sentinels
   ([ADR-0013](adr/0013-node-side-conversion.md)).
6. Publish all six values, transmit, and enter deep sleep **on transmit
   confirmation** (DIO0) rather than a fixed delay.

**Verify:**
- `esphome config` passes.
- Known resistors still yield correct kPa, including both sentinel cases —
  disconnect a sensor and confirm 255; short one and confirm 240.
- Awake time is roughly 2.5 s. If materially longer, find out why; awake time is
  the dominant term in the active budget.

## Phase 4 — Design the PCB

Only after phases 1–3 prove the design in circuit and in code.

1. Schematic capture in KiCad from the netlist in [`README.md`](README.md),
   resolving open items 2 and 3 above.
2. Layout notes that matter:
   - **Solid ground plane**, star point under the MCU.
   - **50 Ω trace** from the SX1276 to the SMA connector, over uninterrupted
     ground, as short as possible.
   - Keep the divider junctions and their traces **short and away from the
     radio and the switching edges**. This is the sensitive analog node.
   - TVS diodes **at the connector**, before anything else, not near the MCU.
   - **No LEDs on the always-on rail** ([ADR-0010](adr/0010-tps7a02-ldo.md)).
   - Test points: 3V3, GND, both junctions, SPI lines, battery.
   - Silkscreen: pin names, connector functions, a version and a date.
3. Order the board and a stencil if reflowing.
4. Store the KiCad project under `soil-node/hardware/`
   ([ADR-0014](adr/0014-monorepo-layout.md)).

## Phase 5 — Assemble and characterise

1. Solder, starting with the power section. **Verify 3.3 V before fitting
   anything else** — a wrong regulator output destroys everything downstream.
2. Clean thoroughly. Flux residue leaks, and at 25 nA quiescent that matters
   ([ADR-0010](adr/0010-tps7a02-ldo.md)).
3. Flash over USB and repeat phase 1's known-resistor verification on the real
   board.
4. **Measure actual deep sleep current.** Target ~15 µA. If it is materially
   higher, find the leak before deploying — this number sets the battery life,
   and it is far easier to diagnose on a bench than in a field.
5. Measure a full wake cycle with a current probe and compare against the budget
   table in [`README.md`](README.md). Update the table with measured values.
6. Conformal coat, leaving connectors and the USB port masked.
7. Run for a week on the bench at the real 30-minute interval, confirming every
   packet arrives and no value drifts.

## Phase 6 — Deploy

1. Install both Watermark sensors at root depth in a PVC access tube, slurried
   in for full soil contact. **Soak new sensors and let them dry once or twice**
   before trusting readings ([`README.md`](README.md), field installation).
2. DS18B20 at the same depth.
3. Mount the enclosure with glands facing **down**, antenna vertical and high.
4. Add Grafana panels: kPa per sensor, soil temperature, battery voltage trend,
   RSSI. **Annotate that higher kPa means drier** — this is the most common
   misreading.
5. Add an alert on the sentinel values (`kpa >= 240`) and on the gateway's stale
   sensor.
6. **Watch it for a full irrigation cycle.** The wetting front should appear as
   a sharp drop in tension, followed by a slow rise as the soil drains and the
   crop transpires. If that shape is absent, the sensors are not in contact with
   the soil.

## Phase 7 — Later: automation

Deliberately deferred ([ADR-0001](adr/0001-logging-only-scope.md)). Once a
season of data exists:

1. Identify the tension at which the crop shows stress and the tension after a
   good irrigation. That range is the operating band, derived from evidence
   rather than from a textbook.
2. Write MQTT automation that starts `kc868-a8/irrigation/start` when tension
   crosses the threshold — subject to three guards:
   - **Exclude the sentinels.** Treating 255 as "very dry" would irrigate on a
     cut cable.
   - **Refuse data older than ~90 minutes.**
   - **Act on a trend across several readings**, never on a single sample.
3. Record the automation rules and thresholds in a new ADR.

## Documentation to update on completion

- Root `README.md`: introduce the node, link to `soil-node/`
  ([ADR-0014](adr/0014-monorepo-layout.md)).
- Root `README.md`: remove the DS18B20 from the A8's hardware description
  ([ADR-0015](adr/0015-reclaim-gpio13-on-gateway.md)).
- `secrets.yaml`: add `lora_encryption_key`, then re-encrypt:
  ```bash
  age --encrypt -R .age-recipients -o secrets.enc.yaml secrets.yaml
  ```
- This file: mark phases done, and fold measured power figures back into
  [`README.md`](README.md).
