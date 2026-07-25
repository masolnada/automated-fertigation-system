# Flow sensor

A YF-B5 hall-effect flow sensor measures water flow and totalises lifetime
water use, and backs the dry-run protection that stops the pump when it is not
moving water.

## Sensor and pin

YF-B5 on **GPIO14** (sensor-header terminal **S1**), read with `pulse_counter`. The sensor emits a pulse train
whose *rate* is proportional to flow — **396 pulses = 1 litre** — so it belongs
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
  a `/ 396.0` lambda converts to L/min. Internal pull-up is **disabled**.
- **Total Water** (`id: total_water`, L) — persisted lifetime odometer. The
  pulse total's `on_value` accumulates the per-update delta into the
  `water_total_l` global (`restore_value: yes`), so it survives the solar/night
  reboots. A negative delta (counter reset on reboot) is treated as the new
  reading.

> [!NOTE]
> **If you later add a DS18B20 temperature sensor, wire it to S2 (GPIO13), not
> S1** — the flow sensor took over S1/GPIO14, so the DS18B20 was moved to
> S2/GPIO13 in firmware. The address in `kc868-a8.yaml` (`0x1c…`) is a
> placeholder: connect the sensor, read its real address from the boot logs,
> and swap it in.

## Calibration

The `396` pulses/L default is the YF-B5's nominal K-factor; real accuracy
depends on your sensor, plumbing, and flow rate. Calibrate against a known
volume — no reflash needed, the factor is the runtime **Pulses Per Liter**
number entity (`id: pulses_per_liter`, default 396).

Water is ~1.000 kg/L, so a kitchen/luggage scale beats jug markings.

1. Route the outlet into a container.
2. Read **Total Water** on `kc868-a8.local` → `T0`.
3. Run water at your **normal irrigation flow** until you've passed a good
   amount (**≥10 L**; more = better resolution).
4. Read **Total Water** → `T1`, and measure what you actually collected →
   `actual_L`.
5. `new_factor = current_factor × (T1 − T0) / actual_L`.
6. Enter `new_factor` in **Pulses Per Liter**. Repeat 2–3× and average.

Calibrate at the flow rate you actually irrigate at — the K-factor drifts at
very low or very high flow. The factor `restore_value`s across reboots; the
lifetime **Total Water** odometer uses whatever factor is set at the time each
delta is accumulated.

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
