# ADR-0007 — Two independent H-bridge dividers, read by an ADS1115

**Status:** Accepted

## Context

A Watermark 200SS is a variable resistor (roughly 550 Ω saturated to 30 kΩ dry),
but it cannot be read like one. Irrometer's developer guide imposes three
constraints, and violating any of them produces both wrong data and a sensor
that erodes within a season:

1. **Alternating-polarity excitation**, total pulse under 50 ms, reading taken
   within 100 µs. Sustained DC drives ion migration: the reading drifts upward
   and the electrodes physically degrade.
2. **Isolation from earth ground.** These sensors sit in wet soil and are a
   direct conductive path from earth into the board.
3. **Isolation between sensors.** Wet soil conducts between two buried sensors.
   Without isolation the circuit measures partly *between* sensors rather than
   *within* one — the guide is explicit that "an open ground path to an
   unpowered sensor must not be permitted."

The circuit must satisfy all three for exactly two sensors.

## Options considered

### A. Two independent H-bridge dividers, one per sensor, into an ADS1115 (chosen)

Two GPIOs and one precision resistor per sensor, each junction on its own ADC
channel. "H-bridge" is loose terminology — there are no transistors. The two
GPIOs *are* the bridge: each can be driven high, driven low, or left high-Z, and
swapping which end is high reverses current through the sensor.

```
        P ──[ Rx 10k ]──┬──[ Watermark Rs ]── N
                        │
                        └── ADS1115 AINx
```

- **Pro:** **Isolation comes free from pin direction.** Between readings both
  pins go to INPUT (high-Z), so the idle sensor has no return path at all. If
  its pins were instead driven low, current from the active sensor's hot
  electrode could flow through the soil to the idle sensor's electrode and into
  ground, shunting the measurement with an unknown resistance. Floating denies
  that current anywhere to go. This is precisely the job the multiplexer does in
  Irrometer's reference circuit, achieved with no part at all.
- **Pro:** No shared component between the two channels, so no single failure
  corrupts both.
- **Pro:** Simple to reason about and simple to express in ESPHome — set pins,
  read, set pins, read, float.
- **Con:** Uses 4 GPIOs and 2 ADC channels rather than 4 GPIOs and 1.

### B. Shared H-bridge with a 74HC4052 multiplexer

Irrometer's own reference circuit: one excitation pair, one resistor, one ADC
channel, with a mux selecting the sensor.

- **Pro:** Scales cleanly to more sensors — the reason Irrometer uses it.
- **Pro:** One known resistor means one calibration value rather than two.
- **Con:** The mux becomes the only thing isolating the sensors. A stuck or
  leaky channel measures both soils in series, and the failure is subtle — a
  plausible-looking wrong number, not an obvious fault.
- **Con:** An extra part, extra pins for channel select, and extra on-resistance
  in series with the measurement.
- **Con:** Its advantage is scaling past two sensors. There are two sensors, and
  no plan for more.

### C. Capacitor charge-time, no ADC

Charge a known capacitor through the sensor and time it to a logic threshold;
`R = T / C`.

- **Pro:** No ADC needed, sidestepping ADC nonlinearity entirely.
- **Pro:** Better conducted-noise immunity on long cable runs, since it measures
  a time interval rather than a voltage level. Irrometer specifically recommends
  it beyond ~30 m of cable.
- **Con:** Needs a stable capacitor — C0G or film, since X7R ceramics vary
  substantially with temperature and applied voltage. In an enclosure that
  swings from −10 °C to +50 °C, that variation lands directly in the reading.
- **Con:** Requires timing code with no off-the-shelf ESPHome support,
  contradicting the "pure YAML" property that
  [ADR-0004](0004-spi-sx1276-radio.md) works to preserve.

### ADC choice: ADS1115 versus the ESP32-C3's internal ADC

- The C3's SAR ADC is **notoriously nonlinear**, with documented
  attenuation-dependent error and unit-to-unit variation. Espressif ships
  factory calibration to compensate, and it is still the weakest peripheral on
  the chip.
- The ADS1115 gives 16-bit resolution, an internal reference independent of the
  supply rail, a programmable gain amplifier suited to the ±2.048 V range in
  use, and **~2 µA in single-shot mode** between conversions.
- Since the whole point is trustworthy long-term data
  ([ADR-0001](0001-logging-only-scope.md)), spending one small I2C part to
  remove the measurement's weakest link is clearly worthwhile.

## Decision

**Two independent H-bridge dividers, one 10 kΩ 0.1 % resistor each, both
junctions read by an ADS1115 in single-shot mode.**

Measurement sequence per sensor:

1. Both pins to OUTPUT; P high, N low. Convert → `V1`.
2. P low, N high. Convert → `V2`.
3. Both pins back to INPUT (high-Z).

```
Rs_A = Rx * V1 / (Vs - V1)
Rs_B = Rx * (Vs - V2) / V2
Rs   = (Rs_A + Rs_B) / 2
```

Averaging the two directions is what makes the excitation pseudo-AC: equal time
in each polarity leaves **net zero accumulated charge** on the sensor. It also
cancels first-order offsets in the drive and the ADC.

## Consequences

- **Rx = 10 kΩ** centres the divider's resolution over the 1–30 kΩ range where
  agronomically interesting readings (10–100 kPa) live.
- **Rx tolerance feeds directly into the result** — a 1 % resistor gives 1 %
  error before anything else. Use 0.1 % metal film with a low temperature
  coefficient (25 ppm/°C). This is a cheap part; do not economise here.
- **GPIO output impedance is a known small error.** A pin sources through
  roughly 30 Ω, costing about 12 mV at the 310 µA peak (saturated sensor) —
  approximately 0.4 %. Negligible against the Watermark's own ±10 % specification
  and the Shock calibration's uncertainty. Recorded so it is not rediscovered
  later as a mystery.
- **TVS diodes on every sensor conductor are mandatory.** These cables run to
  wet earth; induced surges are the standard failure mode. Irrometer omits them
  from published diagrams only for clarity and says so explicitly.
- Total excitation per sensor is a few milliseconds, comfortably inside the
  50 ms limit, and the peak 310 µA is trivial for a 40 mA-rated pin.
- Adding a third sensor later means a redesign, not a configuration change. That
  is an accepted trade for the isolation and simplicity gained.
- The ADS1115's single-shot idle current should be **verified in practice**;
  ESPHome must not leave it free-running. If it does, powering it from a GPIO is
  the fallback (see `../plan.md`, open item 2).
