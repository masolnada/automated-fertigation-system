# Flow sensor

A YF-B5 hall-effect flow sensor measures water flow and cumulative water use
since the last reset, and backs the dry-run protection that stops the pump when
it is not moving water.

## Sensor and pin

YF-B5 on **GPIO14** (sensor-header terminal **S1**), read with `pulse_counter`. The sensor emits a pulse train
whose *rate* is proportional to flow — **396 pulses = 1 litre** (the datasheet
nominal figure) — so it belongs
on a digital counting pin, not an ADC input. GPIO14/S1 is one of the board's
1-Wire / sensor-header pins (the DS18B20 moved to the neighbouring GPIO13/S2).

## Wiring

The sensor is powered at **12V** but its output is a stiff **~5V logic signal**
(it regulates and drives its own output). A resistor divider drops that 5V to a
~3V ESP32-safe level; no MCU pull-up is used because the sensor drives the line
itself.

| YF-B5 wire | Connect to |
|---|---|
| Red — VCC | **12V** (board DC-input `+`) |
| Black — GND | **GND** |
| Yellow — signal | **S1** (GPIO14), via the divider below |

```
Yellow (~5V) ──[ 2.2kΩ ]──┬── S1 (GPIO14)
                          │
                       [ 3.3kΩ ]
                          │
                         GND
```

`5V × 3.3/(2.2+3.3) ≈ 3.0V` — safe, with margin under 3.3V.

> [!IMPORTANT]
> Before connecting S1, measure the divider junction: idle ~3.0V, dropping
> toward 0V when you spin/blow through the sensor, never above 3.3V. Only then
> wire it to the pin. The exact idle voltage depends on your sensor unit — some
> YF-B5 output ~5V regardless of the 12V supply, which is what these values
> assume.

## Firmware

- **Flow Rate** (`id: flow_pulses`, L/min) — `pulse_counter` reports pulses/min;
  a `/ 387.0` lambda converts to L/min. Internal pull-up is **disabled**.
- **Total Water** (`id: total_water`, L) — persisted cumulative litres since
  the last reset. The pulse total's `on_value` accumulates the per-update delta
  into the `water_total_l` global (`restore_value: yes`), so it survives normal
  reboots. A negative delta (counter reset on reboot) is treated as the new
  reading.
- **Reset Total Water** — the native ESPHome button acts immediately when the
  pump is off and flow is known below 0.1 L/min. It explicitly persists zero
  before publishing success. MQTT requests use
  `kc868-a8/flow/reset_total/request`; non-retained results appear on
  `kc868-a8/flow/reset_total/result` as `success`, `already_zero`,
  `rejected_pump_running`, `rejected_flow_active`,
  `rejected_flow_unknown`, or `error_persistence`.

> [!NOTE]
> **If you later add a DS18B20 temperature sensor, wire it to S2 (GPIO13), not
> S1** — the flow sensor took over S1/GPIO14, so the DS18B20 was moved to
> S2/GPIO13 in firmware. The address in `kc868-a8.yaml` (`0x1c…`) is a
> placeholder: connect the sensor, read its real address from the boot logs,
> and swap it in.

## Calibration

The `387.0` pulses/L default is this unit's measured K-factor. The YF-B5's
datasheet nominal K-factor is 396; real accuracy depends on your sensor,
plumbing, and flow rate. Calibrate against a known volume — no reflash needed,
the factor is the runtime **Pulses Per Liter** number entity
(`id: pulses_per_liter`, default 387.0).

Water is ~1.000 kg/L, so a kitchen/luggage scale beats jug markings. This unit
was calibrated against four weighed volumes, with a 0.3 kg bucket tare:

| Run | Reported L | Actual L | Error | Implied factor (pulses/L) |
|---|---:|---:|---:|---:|
| 1 | 10.87 | 11.1 | -2.07% | 387.8 |
| 2 | 11.4 | 11.7 | -2.56% | 385.8 |
| 3 | 11.5 | 11.8 | -2.54% | 385.9 |
| 4 | 10.7 | 10.9 | -1.83% | 388.7 |

The pooled result was 44.47 L reported versus 45.50 L actual: **387.0
pulses/L** (mean 387.1, stdev 1.4, range 385.8–388.7). All runs started from
Total Water = 0 with factor 396; 387.0 is the calibrated default.

A separate verification run was then made with 387.0 already applied; it is not
part of the four-run calibration set. It reported 11.07752 L (11.1 L displayed)
versus 11.1 L actual, an error of -0.20%. That residual is within the scale's
+/-0.45% resolution, confirming the factor at this measurement precision. With
the old 396 factor, the same 11.1 L run would have reported 10.85 L.

1. Route the outlet into a container.
2. Read **Total Water** on `kc868-a8.local` → `T0`.
3. Run water at your **normal irrigation flow** until you've passed a good
   amount (**≥10 L**; more = better resolution).
4. Read **Total Water** → `T1`, and measure what you actually collected →
   `actual_L`.
5. `new_factor = current_factor × (T1 − T0) / actual_L`.
6. Enter `new_factor` in **Pulses Per Liter**. Repeat 2–3× and average.

### Worked example

Current factor 396. You collect and weigh **10.00 L**, and Total Water rose
from `T0 = 812.4` to `T1 = 823.1` → reported `10.7 L`.

```
new_factor = 396 × (823.1 − 812.4) / 10.00
           = 396 × 10.7 / 10.00
           = 423.7 pulses/L
```

The device over-reported (10.7 vs 10.0), so the factor goes **up** to 423.7,
which scales future readings back down.

### Verify

Run a second known volume with the new factor set. Total Water should now track
the measured volume within ~1–2%. If it is still off, average a couple more
runs — pulse counting has run-to-run scatter, especially on short pours. This
unit's 387.0 factor has been independently verified, with its residual error
inside the scale's resolution.

Calibrate at the flow rate you actually irrigate at — the K-factor drifts at
very low or very high flow. The factor `restore_value`s across reboots; the
**Total Water** counter uses whatever factor is set at the time each delta is
accumulated, so calibrate before trusting the counter long-term.

## Dry-run protection

A 1s `interval` stops everything when the pump runs but no water moves — a
knocked-off line, empty tank, or air-locked pump:

- Only armed while the pump is on and **past its 15s priming grace**
  (`pump_on_since_ms`).
- If flow stays **below 0.5 L/min for 3 consecutive seconds**, it calls the
  shared `abort_irrigation` (pump off, both valves off), logs a warning, and
  publishes `ON` to `kc868-a8/flow/dry_run`.
- 0.5 L/min is well under the sensor's ~1 L/min floor, so genuine irrigation
  never trips it.
