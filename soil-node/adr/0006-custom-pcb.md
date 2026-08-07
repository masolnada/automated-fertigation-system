# ADR-0006 — Custom PCB rather than perfboard or modules

**Status:** Accepted

## Context

The node has to survive years in an outdoor enclosure through Cardona winters,
with buried sensor leads entering the box. How it is physically built determines
whether it survives.

## Options considered

### A. Custom PCB, hand-soldered (chosen)

- **Pro:** **Reliability.** Vibration, thermal cycling and condensation are what
  kill field electronics. Soldered joints on a PCB with a solid ground plane
  survive that; jumper wires and header connections work loose or corrode.
- **Pro:** Analog integrity. The Watermark measurement resolves millivolts
  across a 10 kΩ divider; a proper ground plane and short controlled traces make
  that measurement trustworthy in a way perfboard wiring does not.
- **Pro:** RF requires it. The SX1276 antenna feed needs a 50 Ω trace over an
  uninterrupted ground plane. Flying leads at 868 MHz are an antenna in the
  wrong place.
- **Pro:** Full control over what draws sleep current
  ([ADR-0005](0005-esp32-c3-bare-module.md)).
- **Pro:** Reproducible. A second node is a reorder, not an afternoon of
  rewiring and a different set of mistakes.
- **Pro:** Proper mechanical mounting, connectors and strain relief for cables
  that enter through glands.
- **Con:** Design time, fabrication lead time, and a respin if something is
  wrong.
- **Con:** Requires SMD soldering — the ESP32-C3-MINI-1, TPS7A02 (SOT-23-5) and
  ADS1115 (VSSOP-10) are all fine with a fine tip and flux, but not beginner
  work.

### B. Modules on perfboard

- **Pro:** Fast, no lead time, easy to modify mid-build.
- **Con:** Every connection is a future intermittent fault. In a box that
  freezes and thaws weekly, this is not pessimism, it is the expected outcome.
- **Con:** No ground plane, so analog noise and RF behaviour are both
  compromised.
- **Con:** Modules bring the parasitic current draws that
  [ADR-0005](0005-esp32-c3-bare-module.md) exists to avoid.

### C. Off-the-shelf LoRa sensor board

- **Pro:** No design work at all.
- **Con:** None implement Watermark pseudo-AC excitation — the whole reason
  custom hardware is needed ([ADR-0007](0007-h-bridge-divider-per-sensor.md)).
- **Con:** Whatever regulator and USB chip they carry sets the sleep current,
  and it is rarely optimised.

## Decision

**Custom PCB**, two layers, hand-soldered, in an IP67 enclosure.

## Consequences

- Design must be complete and checked before fabrication; a respin costs weeks.
  Hence the explicit netlist in `../README.md` rather than a hand-wave.
- **Prototype on a breadboard first**, at least the Watermark front end. The
  H-bridge divider and the resistance calculation should be validated against a
  known resistor before committing to copper.
- Include test points: 3V3, GND, both divider junctions, and the SPI lines.
  Debugging a sealed board without them is miserable.
- Silkscreen everything — pin names, connector functions, a version number and a
  date. In three years this is the only documentation physically present.
- A conformal coating on the assembled board is cheap insurance against
  condensation, and worth doing given the environment.
- Keep the design files in the repository ([ADR-0014](0014-monorepo-layout.md))
  so the board can be reordered years later without reverse-engineering it.
