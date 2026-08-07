# ADR-0008 — Dedicated DS18B20 for soil temperature

**Status:** Accepted

## Context

Converting Watermark resistance to soil water tension requires temperature:

```
kPa = (-3.213 * R - 4.093) / (1 - 0.009733 * R - 0.01205 * T)
```

The temperature term exists because ion mobility in the sensor's granular matrix
rises with temperature: **warm soil reads as lower resistance at identical
moisture.** The error is roughly **1.8 % per °C** away from the 24 °C reference.

Cardona's soil is not 24 °C. Winter soil at root depth sits around 8–12 °C,
summer around 25–30 °C. A fixed 24 °C assumption is therefore wrong by roughly
**20 % in winter** — systematically, in the direction of reporting the soil
wetter than it is, which is exactly the wrong direction for an irrigation
decision.

## Options considered

### A. Dedicated DS18B20 at sensor depth (chosen)

- **Pro:** Removes a large systematic error and replaces it with a measured
  value. This converts a plausible-looking wrong number into a trustworthy one,
  which is the entire premise of [ADR-0001](0001-logging-only-scope.md).
- **Pro:** Already a known quantity in this project — one is in service on the
  KC868-A8 (`controller/kc868-a8.yaml:508`) and ESPHome's support is mature.
- **Pro:** Soil temperature is independently useful. Germination, root activity
  and microbial activity (relevant given the humic acid and micro-organism
  injection) are all temperature-driven, and frost risk is visible in the data.
- **Pro:** One GPIO, one 4.7 kΩ resistor, waterproof probes are inexpensive.
- **Con:** ~750 ms per 12-bit conversion, which is the largest single
  contributor to awake time (~6.3 µAh per cycle, roughly a quarter of the active
  budget).
- **Con:** A third cable entering the enclosure, so a third gland to seal.

### B. Fixed 24 °C assumption

- **Pro:** Free — no part, no cable, no conversion time.
- **Con:** ~20 % systematic error in winter, in the least helpful direction.
- **Con:** The error is invisible in the data. A wrong-but-plausible reading is
  the worst possible failure mode for a measurement intended to justify
  irrigation decisions.

### C. Irrometer 200TS thermistor

The purpose-made Watermark soil temperature sensor.

- **Pro:** Designed for exactly this, and the calibration is matched to the
  application.
- **Con:** Consumes another ADC channel plus a bias resistor.
- **Con:** Requires a Steinhart-Hart or lookup calibration that would have to be
  sourced and implemented, versus a DS18B20 that reports °C directly.
- **Con:** More expensive and harder to obtain than a commodity DS18B20.

### D. Reuse the A8's existing DS18B20

- **Con:** It is at the controller, not at the plants, and soil temperature at
  root depth is the quantity the equation needs. Air or enclosure temperature is
  a different number.
- **Con:** It would require the node to receive data, adding a receive path to
  what is otherwise a pure transmitter ([ADR-0002](0002-lora-only-topology.md)).
- **Con:** Moot in any case — that sensor is being relocated to free a GPIO
  ([ADR-0015](0015-reclaim-gpio13-on-gateway.md)).

## Decision

**One waterproof DS18B20 on the node, buried at the same depth as the Watermark
sensors**, read immediately before the tension calculation.

## Consequences

- **Depth matters.** Placed at the surface or inside the enclosure it measures
  the wrong thing and the compensation is worse than useless because it looks
  legitimate. Install it at root depth, alongside the Watermarks.
- The 750 ms conversion dominates awake time. **Use 12-bit resolution anyway** —
  lower resolutions are faster but 0.5 °C granularity would inject ~0.9 % error
  back into a correction that exists to remove ~20 %. The energy is affordable
  ([ADR-0009](0009-aa-lithium-battery.md)).
- Soil temperature is transmitted as its own value, not merely consumed
  internally. It is useful data in its own right and it makes the compensation
  auditable after the fact.
- If the DS18B20 fails or reads implausibly (outside −20 to +60 °C), the
  firmware should fall back to 24 °C and flag it, rather than propagating a
  garbage temperature into every tension reading.
- A single 1-Wire bus is used, so a second probe (e.g. at a different depth)
  could be added later on the same GPIO with no hardware change.
