# ADR-0015 — Move the A8's DS18B20 off GPIO13 to free a pin for SPI

**Status:** Accepted

## Context

Making the KC868-A8 a LoRa gateway ([ADR-0003](0003-a8-as-gateway.md)) requires
SPI: **SCK, MOSI, MISO, CS and RST — five pins minimum.**

The A8 is a dense board and most of the ESP32's GPIOs are already committed.
A full audit of what is actually available:

| Pins | Status |
|---|---|
| GPIO4, GPIO5 | I2C bus for both PCF8574 expanders (`controller/kc868-a8.yaml:36`). All eight relays and all eight digital inputs depend on this. **Untouchable.** |
| GPIO14 | YF-B5 flow sensor (`controller/kc868-a8.yaml:562`). Drives the dry-run watchdog. **In use.** |
| GPIO13 | DS18B20 temperature (`controller/kc868-a8.yaml:508`). **In use.** |
| GPIO32, GPIO33 | **Free** — headers S3/S4. 10 kΩ pull-ups to 3.3 V, harmless for SPI. |
| GPIO2, GPIO15 | **Free** — the unpopulated 433 MHz module header. Both are strapping pins. |
| GPIO34, GPIO35 | Analog inputs A1/A2. **Not usable** — see below. |
| GPIO0, 17, 18, 19, 21, 22, 23, 25, 26, 27 | LAN8720 Ethernet PHY. Blocked even though Ethernet is unused. |

**Why A1/A2 cannot be used**, despite appearing free: they sit on the *outputs*
of the LM258 dual op-amp input-conditioning stage. An op-amp output actively
drives its pin, so it would fight anything the ESP32 asserted and would swamp a
weak MISO signal from the radio. They are input-only pins connected to a driven
source — useless for this.

**Why the Ethernet pins cannot be used:** the LAN8720 PHY drives RXD0, RXD1 and
CRS_DV continuously, and the 50 MHz clock line is likewise active. The PHY is
powered whenever the board is, regardless of whether ESPHome configures
Ethernet.

That leaves **four usable pins for a five-pin requirement.** Short by exactly
one.

## Options considered

### A. Reclaim GPIO13 by relocating the A8's DS18B20 (chosen)

- **Pro:** Immediate, free, reversible, and involves no board modification.
- **Pro:** Gives exactly five pins: GPIO13, 32, 33, 2, 15.
- **Pro:** The A8's own DS18B20 is not load-bearing. Nothing in the irrigation
  logic reads it — it is a diagnostic reading. Meanwhile the node is about to
  supply a **soil** temperature at root depth
  ([ADR-0008](0008-ds18b20-soil-temperature.md)), which is the more useful
  number.
- **Con:** Loses that temperature reading unless it is re-homed. It could later
  share the node's 1-Wire bus concept on a different free pin if one appears, or
  simply be dropped.

### B. Use GPIO12

- **Pro:** Would leave the DS18B20 alone.
- **Con:** Its routing on the v1.7 board is unknown and would need the schematic
  or a continuity check.
- **Con:** GPIO12 is a strapping pin that **must be low at boot** — a high level
  selects a 1.8 V flash voltage and the board will not start. That makes it the
  worst possible choice for chip select, which idles high.

### C. Cut the LM258 trace on A1 to free GPIO34 as a true input

- **Pro:** Would free a genuine input-only pin, ideal for MISO.
- **Con:** Irreversible surgery on a working board, permanently removing an
  analog input. Not justified when option A costs nothing.

### D. Give up `rst_pin`

- **Con:** It is a required key in ESPHome's `sx127x` component. Avoiding it
  would mean an external RC reset circuit *and* forking the component —
  abandoning the "pure upstream YAML" property that
  [ADR-0004](0004-spi-sx1276-radio.md) exists to protect. Firmly rejected.

### E. Use a UART radio module instead

- **Pro:** Would need only 2–4 pins and dissolve the problem entirely.
- **Con:** Considered and rejected in [ADR-0004](0004-spi-sx1276-radio.md): it
  trades a one-time pin shortage for permanent custom-component maintenance.

## Decision

**Remove the DS18B20 from GPIO13** on the KC868-A8 and assign the SPI bus:

| A8 GPIO | Signal | Rationale |
|---|---|---|
| GPIO15 | SCK | Strapping pin, must be low at boot — SPI clock idles low. Safe. |
| GPIO13 | MOSI | Freed by this decision. No boot constraint. |
| GPIO2 | MISO | Strapping pin, must be low at boot. The radio only drives MISO while CS is asserted, so it floats during boot. Safe. |
| GPIO32 | CS | Ordinary GPIO, no boot constraint. Idles high, which is why it must not be a strapping pin. |
| GPIO33 | RST | Ordinary GPIO. |
| — | DIO0 | **Omitted.** Optional in ESPHome; one packet per 30 minutes does not justify interrupt-driven receive, and there is no sixth pin. |

## Consequences

- **This exhausts the KC868-A8's expansion capacity.** Any future peripheral
  requires either giving something up or moving to an I2C part on the existing
  bus. Worth remembering before promising the board anything else.
- The `one_wire:` block and the `dallas_temp` sensor must be removed from
  `controller/kc868-a8.yaml`, and the README's hardware description updated.
- **Strapping pin assignment is deliberate, not incidental.** GPIO2 and GPIO15
  must be low at boot; the assignment above ensures that. Swapping any two of
  these pins for convenience during wiring could produce a board that does not
  boot, with a cause that is far from obvious.
- **Verify the pinout before soldering.** The mapping assumes the v1.7 board
  matches the published KinCony pinout. Do a continuity check from the S3/S4 and
  433 MHz headers to the ESP32 module pins first. A wrong assumption here means
  desoldering.
- Without DIO0, ESPHome polls the radio for received packets. At one packet per
  30 minutes on a mains-powered gateway, the cost is irrelevant.
- If the A8's air/enclosure temperature is later wanted back, the cleanest route
  is an I2C sensor on the existing bus rather than reclaiming a GPIO.
