# ADR-0001 — The node logs data; it does not make irrigation decisions

**Status:** Accepted

## Context

The fertigation controller currently waters on a fixed schedule started by a
button, an MQTT message, or a physical switch (`controller/kc868-a8.yaml`, `script:
irrigation_sequence`). Nothing knows whether the soil actually needs water.
Watering a saturated soil wastes water, leaches nutrients past the root zone,
and drowns roots; watering too late stresses the crop.

Two Watermark 200SS sensors are available. The question is what role they play:
a passive instrument, or an input to closed-loop control.

This decision comes first because it determines how much the rest of the system
has to be trusted. A sensor that only draws a graph can be wrong for a week
without consequence. A sensor that opens a valve cannot.

## Options considered

### A. Logging only, automation later via MQTT (chosen)

The node reports readings. They land in MQTT and Grafana. Watering decisions
stay where they are today, and any future automation is written against the
MQTT topics, outside the firmware.

- **Pro:** No safety-critical path through a device that will spend years
  buried in a field. A missed packet or a drifting sensor produces a gap in a
  graph, not a flooded bed or a dead crop.
- **Pro:** The irrigation thresholds are unknown. The literature offers ranges
  (30–60 kPa for vegetables), but the right number depends on this soil, this
  crop and this emitter layout. Guessing it and encoding it now would be
  automating a guess.
- **Pro:** Automation logic in MQTT (Node-RED, Home Assistant, a script) can be
  changed in seconds without reflashing a device that is not physically nearby.
- **Con:** No automatic protection against watering when already wet, until the
  automation is written.

### B. Closed-loop control in firmware

The node transmits, the A8 decides, the sequence runs or is skipped.

- **Pro:** Works with no broker, no network, no external service.
- **Con:** Couples a battery-powered radio node to the actuation path. Lost
  packets now have consequences. Every threshold change means reflashing.
- **Con:** Encodes agronomic thresholds that are not yet known.

### C. Sensors read directly by the A8

Wire the Watermarks to the A8's analog inputs and skip the node entirely.

- **Pro:** Dramatically simpler; no radio, no battery, no PCB.
- **Con:** Requires the sensors to be within cable distance of the controller,
  which defeats the purpose of measuring where the plants are.
- **Con:** The A8's A1/A2 inputs sit behind an LM258 op-amp stage designed for
  0–5 V signals, not for the alternating-polarity excitation a Watermark needs.
- **Con:** The A8 is mains-scale powered and always awake; it cannot be moved to
  where the soil is.

## Decision

**Logging only.** The node publishes soil tension, soil temperature and battery
voltage. Irrigation automation is written later, against MQTT topics, once
enough data exists to choose a threshold from evidence.

## Consequences

- Accuracy and long-term reliability matter more than latency. A reading that
  arrives 30 minutes late is fine; a reading that is quietly wrong is not.
  This justifies the DS18B20 ([ADR-0008](0008-ds18b20-soil-temperature.md)) and
  transmitting raw resistance alongside kPa
  ([ADR-0013](0013-node-side-conversion.md)).
- The node needs no receive path for commands, making it a pure transmitter and
  saving considerable energy ([ADR-0002](0002-lora-only-topology.md)).
- A future ADR will cover the automation rules, once the data supports them.
- Data quality must be verifiable from the graph alone. Hence the fault
  sentinels (255 open, 240 short) and the gateway stale sensor
  ([ADR-0003](0003-a8-as-gateway.md)) — a dead node must look dead, not look
  like dry soil.
