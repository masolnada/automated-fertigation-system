# ADR-0003 — The KC868-A8 is the LoRa gateway

**Status:** Accepted

## Context

[ADR-0002](0002-lora-only-topology.md) requires something to receive LoRa
packets and republish them to MQTT. That gateway must be permanently powered,
on the home network, and within radio range of the node.

## Options considered

### A. The existing KC868-A8 fertigation controller (chosen)

- **Pro:** It already exists, is already in the field, already has WiFi, and
  already has a configured MQTT connection to the broker
  (`controller/kc868-a8.yaml:643`). Adding a receiver is a YAML change plus a module.
- **Pro:** It is already powered continuously from the solar/battery system
  (100 Wp panel, MPPT, 8 Ah LiFePO4). Its idle draw is ~0.13 A; an SX1276 in
  receive mode adds ~12 mA, under 10 % of idle and utterly negligible against a
  pump that draws 3.5 A.
- **Pro:** Physical proximity. Both node and gateway are in the same field, so
  there are no building walls in the path and both antennas can be mounted high.
- **Pro:** Conceptual cohesion. The soil data exists to inform irrigation; the
  irrigation controller holding that data locally means a future closed-loop
  option costs no new hardware, even though it is not the current plan
  ([ADR-0001](0001-logging-only-scope.md)).
- **Con:** **Pin scarcity.** The A8 has almost no free GPIOs, and accommodating
  SPI forces the DS18B20 to move
  ([ADR-0015](0015-reclaim-gpio13-on-gateway.md)). This is the real cost.
- **Con:** Couples the two devices. A firmware change to the controller now
  risks the sensor data path, and vice versa. Mitigated by them living in one
  repository ([ADR-0014](0014-monorepo-layout.md)).

### B. A dedicated ESP32 + SX1276 gateway indoors

- **Pro:** No pin pressure, complete freedom of design, and it isolates the
  irrigation controller from sensor-related changes.
- **Con:** Another device to build, power, mount, and maintain — for a job the
  A8 can do with one module and five wires.
- **Con:** Indoors means a building wall between node and gateway, which costs
  more link margin than any radio setting recovers.

### C. Meshtastic or an off-the-shelf LoRaWAN gateway

- **Pro:** Mature, feature-rich, possible mesh redundancy.
- **Con:** A whole ecosystem to learn and maintain for a two-node link.
- **Con:** Meshtastic's own MQTT bridging would mean adopting its message
  schema and running its firmware, when ESPHome's `packet_transport` delivers
  named sensor values directly with no glue at all.

## Decision

**The KC868-A8 is the gateway.** It runs `sx127x` in receive mode with
`packet_transport` as a consumer, and its existing `mqtt:` block republishes the
received values automatically.

## Consequences

### Received values become A8 entities

This is not a choice — it is how `packet_transport` works. Received values are
reconstructed as ordinary sensor entities on the gateway, and the existing MQTT
configuration publishes every entity. MQTT publication is therefore a
*consequence* of the entities existing, not an alternative to it.

Useful side effects:

- **Field debugging without a broker.** `http://kc868-a8.local` over the
  fallback AP shows live soil tension while standing next to the sensor —
  no laptop, no MQTT client, no home network. When burying probes and needing to
  confirm one actually reads, this is the difference between a productive
  afternoon and guesswork.
- **Failure isolation.** Values present in the A8 web UI but absent from Grafana
  means the radio link is healthy and the problem is MQTT or the broker. Absent
  from both means the node or the radio. That split costs nothing and saves an
  hour of blind debugging.
- **Local logic becomes possible later** without a broker round trip, should
  closed-loop control ever be wanted.

### A stale/last-seen sensor is required

A dead node produces *no* packets, and the last received value simply sits in
the entity, frozen but entirely plausible. On a Grafana panel this looks like
soil that has stopped changing — which, for a slowly-varying quantity, is not
obviously wrong. It is the most dangerous failure mode for a system intended to
drive irrigation decisions.

The gateway therefore exposes a binary sensor that goes offline after roughly
**90 minutes** (three missed reports at the 30-minute interval,
[ADR-0012](0012-thirty-minute-interval.md)) with no packet. Three misses rather
than one, because single packet losses are expected on an unacknowledged link.

### Other consequences

- The A8's DS18B20 must move ([ADR-0015](0015-reclaim-gpio13-on-gateway.md)).
- Both firmwares share the frequency, sync word, encryption key and sensor
  names. Changing one without the other silently breaks the link — which is the
  argument for the monorepo ([ADR-0014](0014-monorepo-layout.md)).
- The A8's receiver is always listening, so it will never miss a packet through
  being asleep. There is no need for the node and gateway to agree on a
  schedule.
