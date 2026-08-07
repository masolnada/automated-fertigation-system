# ADR-0004 — SPI SX1276 transceivers on both ends

**Status:** Accepted

## Context

Both node and gateway need an 868 MHz LoRa radio. Two families are practical:
SPI transceiver chips (SX127x, SX126x) driven directly by the host, and UART
modules (Ebyte E220/E32) that wrap a transceiver in their own MCU and present a
serial "transparent transmission" interface.

The choice is really about **which software has to exist**, not about radio
performance — both families use the same underlying Semtech silicon.

## Options considered

### A. SPI SX1276 (RFM95W / Ra-01H) with ESPHome's `sx127x` (chosen)

- **Pro:** **Native, upstream ESPHome support.** The `sx127x` component plus
  `packet_transport` sends named sensor values from one ESPHome node to another
  with no custom C++ on either side. This is the single strongest argument: no
  component to write, no packet format to define, no maintenance burden when
  ESPHome updates.
- **Pro:** `packet_transport` also brings XXTEA encryption and rolling-code
  replay protection for free ([ADR-0016](0016-packet-transport-security.md)).
- **Pro:** Full control of the radio — spreading factor, bandwidth, coding rate,
  sync word, TX power — all as YAML, all changeable without touching a module's
  proprietary configuration registers.
- **Pro:** RSSI and SNR are exposed per packet, which turns link debugging from
  guesswork into measurement.
- **Pro:** Direct register control means the radio can be put into true sleep
  between transmissions, which matters on the battery side.
- **Con:** Needs 5–6 pins (SCK, MOSI, MISO, CS, RST, optionally DIO0). On the
  gateway this is genuinely painful and forces
  [ADR-0015](0015-reclaim-gpio13-on-gateway.md).

### B. UART module (Ebyte E220-900T22D)

- **Pro:** Only 2–4 pins (TX, RX, and optionally M0/M1 mode pins), which would
  entirely dissolve the gateway's pin problem.
- **Pro:** The module handles the radio internally; simpler electrically.
- **Con:** **No native ESPHome driver.** A custom external component would have
  to be written and maintained on both ends, plus a payload format defined,
  serialised, parsed and versioned by hand.
- **Con:** That is permanent maintenance — every ESPHome upgrade is a potential
  break, with no upstream to absorb it — traded for a one-time pin-count win
  that a single DS18B20 relocation also solves.
- **Con:** Configuration lives in the module's own registers, set over UART in a
  separate mode. It is state stored in hardware rather than in version control,
  which is exactly the kind of thing that is forgotten and then debugged for an
  evening.

### C. SX1262 (SX126x family) instead of SX1276

- **Pro:** Newer silicon, somewhat lower receive current, slightly better
  sensitivity. ESPHome has an `sx126x` component too.
- **Con:** No decisive advantage here. Receive current only matters on the
  gateway, which is not battery-limited, and transmit energy is dominated by
  airtime, which is identical.
- **Con:** SX1276 modules (RFM95W) are the more common, better-documented,
  easier-to-source part. Given a hand-soldered board, availability and community
  troubleshooting material carry real weight.

## Decision

**SX1276 over SPI on both ends**, using ESPHome's `sx127x` component as a
`packet_transport` platform. Module: RFM95W-868S2 or the Ai-Thinker Ra-01H
equivalent.

## Consequences

- Both firmwares stay **pure ESPHome YAML**. No C++, no external components, no
  custom packet format. This is the property that makes the project maintainable
  years from now.
- Sensor values arrive at the gateway **already named and typed**, so MQTT
  topics appear without any mapping code.
- The gateway loses a GPIO to this decision
  ([ADR-0015](0015-reclaim-gpio13-on-gateway.md)).
- The node must wire DIO0 so the radio can signal transmit-complete rather than
  the firmware waiting a fixed worst-case delay — a direct saving in awake time.
- Should ESPHome ever drop `sx127x`, the fallback is pinning a version, which is
  a known and acceptable risk. The `victron_ble` external component is already
  pinned to a tag for the same reason (`controller/kc868-a8.yaml`).
