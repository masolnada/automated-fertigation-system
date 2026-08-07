# ADR-0002 — LoRa only on the node; no WiFi

**Status:** Accepted

## Context

The node must run unattended on a battery for a long time, in a field, and get
its readings back to an MQTT broker on the home network.

A point worth stating plainly, because it is a common misconception:
**MQTT and LoRa are not alternatives at the same layer.** MQTT is an
application protocol that needs an IP link. LoRa is a raw radio link with no IP
and no notion of a broker. A device cannot "speak MQTT over LoRa" — something
downstream must bridge one to the other.

So the real question is which radio the *node* uses, and where the bridge sits.

## Options considered

### A. LoRa only; a gateway bridges to MQTT (chosen)

The node has no WiFi. It transmits a small packet and sleeps. A gateway on the
home network receives it and republishes to the broker.

- **Pro:** Energy. This is the whole argument, and it is decisive.
  - WiFi association, DHCP, TCP connect and an MQTT publish takes **2–5 s at
    100–150 mA** even when everything goes well — call it 200 µAh per report.
  - A LoRa transmission of the same data is **~90 ms at ~45 mA**, about
    **1.1 µAh**.
  - That is roughly **100× less energy per reading**, and it is the difference
    between replacing batteries every few weeks and every few years.
- **Pro:** Range. LoRa at SF9 reaches kilometres; WiFi struggles past a field
  boundary. The sensors go where the plants are, not where the router reaches.
- **Pro:** WiFi's power draw is also unpredictable — a weak signal or a busy
  channel turns a 2 s connection into a 10 s one, and the battery estimate with
  it.
- **Con:** Requires a gateway to exist ([ADR-0003](0003-a8-as-gateway.md)).
- **Con:** No IP connectivity to the node: no OTA updates, no web UI, no logs
  over the network. Firmware changes require physically retrieving it or
  bringing a USB cable to the field.

### B. WiFi/MQTT with LoRa as a fallback

- **Pro:** No gateway needed while in WiFi range; the node publishes directly.
- **Con:** Pays the full WiFi energy cost on every normal report, which is the
  cost this design exists to avoid.
- **Con:** Two radios, two failure modes, two code paths, and the node must
  decide between them — significant complexity for a device meant to be simple
  enough to trust unattended.

### C. Both radios, always

- **Con:** Worst energy, most code, and no benefit that B does not already give.
  Rejected without much thought.

### D. LoRaWAN (via The Things Network) instead of raw LoRa

- **Pro:** Standardised, potentially uses existing public gateway coverage,
  proper ADR (adaptive data rate) and downlink support.
- **Con:** Depends on gateway coverage that may not exist in Cardona, or on
  running a private LoRaWAN gateway — strictly more infrastructure than a second
  SX1276 on a board that already exists.
- **Con:** Data would travel via a third-party network server and come back,
  rather than staying entirely on-premises.
- **Con:** Heavier stack, join procedures, session state to persist across deep
  sleep. Considerable complexity for a two-node point-to-point link.

## Decision

**LoRa only.** The node is a pure transmitter with no WiFi hardware active. The
KC868-A8 acts as the LoRa-to-MQTT bridge.

## Consequences

- The node's energy budget becomes dominated by sleep current rather than
  transmission, which is what makes the LDO choice critical
  ([ADR-0010](0010-tps7a02-ldo.md)).
- **No OTA.** Getting firmware onto the node means physical access. This raises
  the stakes on validating the firmware before deployment and argues for a USB
  connector reachable without desoldering.
- The link is one-way and unacknowledged. A lost packet is simply lost. This is
  acceptable for a slowly-varying quantity ([ADR-0012](0012-thirty-minute-interval.md))
  but means the gateway must detect silence explicitly
  ([ADR-0003](0003-a8-as-gateway.md)).
- Link security must be handled in the payload, since there is no TLS
  ([ADR-0016](0016-packet-transport-security.md)).
