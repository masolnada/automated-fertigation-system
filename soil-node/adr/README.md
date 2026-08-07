# Architecture Decision Records — Soil Node

Each file records one decision: what problem forced it, what the options were,
what was chosen, and what that choice costs. They are written to be read years
from now by someone (probably you) who has forgotten the reasoning.

The order is roughly the order in which the decisions were taken, because most
of them depend on the ones above.

| # | Decision | Outcome |
|---|---|---|
| [0001](0001-logging-only-scope.md) | What is the node for? | Logging only; automation lives MQTT-side |
| [0002](0002-lora-only-topology.md) | How does data get home? | LoRa only, no WiFi on the node |
| [0003](0003-a8-as-gateway.md) | What receives the LoRa packets? | The existing KC868-A8 |
| [0004](0004-spi-sx1276-radio.md) | Which radio module? | SPI SX1276, not a UART module |
| [0005](0005-esp32-c3-bare-module.md) | Which MCU? | ESP32-C3-MINI-1, bare module |
| [0006](0006-custom-pcb.md) | How is it built? | Custom PCB, hand-soldered |
| [0007](0007-h-bridge-divider-per-sensor.md) | How are the sensors read? | Two independent H-bridge dividers + ADS1115 |
| [0008](0008-ds18b20-soil-temperature.md) | Temperature compensation? | Dedicated DS18B20 at sensor depth |
| [0009](0009-aa-lithium-battery.md) | Which battery? | 3× AA lithium primary, no solar |
| [0010](0010-tps7a02-ldo.md) | Which regulator? | TPS7A02 LDO, 25 nA quiescent |
| [0011](0011-lora-radio-parameters.md) | Radio settings? | 868 MHz, SF9, 125 kHz, CR 4/5, 14 dBm |
| [0012](0012-thirty-minute-interval.md) | How often to report? | Every 30 minutes |
| [0013](0013-node-side-conversion.md) | Where does R become kPa? | On the node, sending both raw and kPa |
| [0014](0014-monorepo-layout.md) | Where does the code live? | This repository, monorepo |
| [0015](0015-reclaim-gpio13-on-gateway.md) | The A8 is one pin short | Move its DS18B20 off GPIO13 |
| [0016](0016-packet-transport-security.md) | Securing the link? | Encryption + rolling code |

## Format

Each ADR follows the same shape:

- **Status** — accepted, superseded, or proposed
- **Context** — the forces that made a decision necessary
- **Options considered** — with honest pros and cons, including for the losers
- **Decision** — what was chosen
- **Consequences** — what this costs and what it forecloses

If a decision is ever reversed, add a new ADR that supersedes the old one rather
than editing history. The old reasoning is often the most useful part.
