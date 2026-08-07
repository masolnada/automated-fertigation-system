# ADR-0013 — Convert to kPa on the node, and transmit both raw resistance and kPa

**Status:** Accepted

## Context

The measurement chain is: ADC voltages → sensor resistance → soil water tension
in kPa. The conversion requires the Shock piecewise equation and a temperature
value. There are three places it could happen — on the node, on the gateway, or
downstream in Grafana — and a separate question of what actually goes on the
wire.

## Options considered — where to convert

### A. On the node (chosen)

- **Pro:** The node is the only place where resistance and temperature naturally
  coexist. Converting anywhere else means transmitting both and re-pairing them
  downstream, which is more moving parts for no benefit.
- **Pro:** The transmitted value is immediately meaningful. It appears correctly
  in the A8 web UI, in MQTT and in Grafana with no transformation anywhere.
- **Pro:** Any future MQTT automation consumes a ready number rather than
  reimplementing a three-branch piecewise equation.
- **Con:** Changing the calibration requires reflashing, which without OTA
  ([ADR-0002](0002-lora-only-topology.md)) means a field visit. Mitigated
  entirely by also sending raw resistance (below).

### B. On the gateway

- **Pro:** The gateway is reflashable over OTA, so calibration changes are easy.
- **Con:** Requires transmitting resistance and temperature and correlating them
  per-sensor at the far end — reconstructing on the gateway a relationship that
  was intact on the node.
- **Con:** Splits the measurement logic across two devices, so understanding a
  reading means reading two configurations.

### C. In Grafana

- **Pro:** Calibration becomes fully editable, and history can be recomputed.
- **Con:** Puts a three-branch piecewise equation with sentinel handling into
  dashboard queries, where it is awkward to express and easy to get wrong.
- **Con:** Any MQTT automation would have to duplicate that logic independently,
  creating two implementations that will eventually disagree.
- **Con:** The A8 web UI would show meaningless raw values, destroying the
  field-debugging benefit described in [ADR-0003](0003-a8-as-gateway.md).

## Options considered — what to transmit

### D. kPa only

- **Pro:** Smallest payload.
- **Con:** **Loses the ground truth irrecoverably.** A bad calibration cannot be
  undone after the fact; the original measurement is gone.
- **Con:** Fault diagnosis becomes guesswork. A disconnected sensor produces an
  implausible kPa, but so does genuinely bone-dry soil.

### E. Raw resistance only

- **Pro:** Preserves everything, smallest payload.
- **Con:** Pushes the conversion problem downstream, which is option C's
  drawbacks under another name.

### F. Both (chosen)

- **Pro:** **Resistance is the ground truth.** It permits re-deriving kPa later
  with a different or improved calibration, across the entire history — which is
  impossible if only the converted value was stored.
- **Pro:** **Fault diagnosis becomes unambiguous.** An open circuit (cable cut,
  sensor pulled out) reads ≥35 kΩ; a short reads <300 Ω. These are obvious in
  resistance and merely implausible in kPa.
- **Pro:** Sensor drift and ageing are visible in the resistance trend, which is
  how sensor health is actually assessed.
- **Con:** Two extra values per sensor in the payload — a handful of bytes,
  against a packet whose airtime is unchanged in practice
  ([ADR-0011](0011-lora-radio-parameters.md)).

## Decision

**Convert on the node. Transmit, per sensor, both raw resistance (Ω) and soil
water tension (kPa)**, plus soil temperature and battery voltage.

Implement all branches of Irrometer's piecewise conversion, not just the Shock
middle range:

| Resistance | Output |
|---|---|
| ≥ 35 kΩ or 0 | **255** (sentinel: open circuit) |
| > 8 kΩ | `(-2.246 - 5.239*R*tc - 0.06756*R²*tc²)` |
| 1–8 kΩ | Shock 1998 |
| 550 Ω – 1 kΩ | `(R*23.156 - 12.736) * tc` |
| 300–550 Ω | 0 kPa (saturated) |
| < 300 Ω | **240** (sentinel: short circuit) |

where `tc = 1.00 + 0.018 * (T - 24.00)` and `R` is in kΩ.

## Consequences

- **Sentinel values 240 and 255 are explicit fault codes**, following Irrometer's
  own convention. They are greppable, unmistakable in a graph, and make an MQTT
  alert rule trivial: `kpa >= 240` means "go look at the hardware", not "the soil
  is extremely dry".
- Any future MQTT automation **must exclude the sentinels** before acting.
  Treating 255 as a very dry soil would trigger irrigation on a disconnected
  cable — the exact failure this design is meant to make impossible.
- Recomputing history from raw resistance requires the temperature from the same
  reading, so soil temperature must also be retained. It is transmitted
  ([ADR-0008](0008-ds18b20-soil-temperature.md)) and therefore stored.
- The Shock equation is only validated for 10–100 kPa. Readings outside that
  range come from the extrapolated branches and should be treated as indicative
  rather than precise — worth noting on the Grafana panel.
- Payload: 2 sensors × (resistance + kPa) + temperature + battery = 6 values.
  Well within a single LoRa packet at SF9.
