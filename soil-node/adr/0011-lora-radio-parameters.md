# ADR-0011 — 868 MHz, SF9, 125 kHz, CR 4/5, 14 dBm

**Status:** Accepted

## Context

LoRa trades range against airtime, and airtime against energy. The parameters
must be chosen jointly, and they are constrained by both physics and European
radio regulations.

Both node and gateway sit **in the same field**, with no buildings in the path
and both antennas mountable high — a benign link, which allows a moderate
setting rather than a defensive one.

## Options considered

### Frequency band

**868 MHz (chosen)** — the licence-free ISM band for LoRa in the EU. 433 MHz is
also available and propagates slightly better through vegetation, but it is
shared with vastly more traffic (garage doors, weather stations, remote
controls) and needs a physically larger antenna for equivalent efficiency.
915 MHz is not legal here.

Sub-band **g1 (868.0–868.6 MHz)** permits a **1 % duty cycle**: 36 seconds of
airtime per hour.

### Spreading factor

The spreading factor sets how much each symbol is spread in time. Each step up
roughly **doubles airtime and doubles transmit energy** for the same payload,
while adding roughly 2.5 dB of link budget.

| SF | Airtime (~40 B) | Rough LOS range | Note |
|---|---|---|---|
| SF7 | ~50 ms | ~2 km | Fastest, least margin |
| **SF9** | **~90 ms** | **~5 km** | **Chosen** |
| SF12 | ~800 ms | 10 km+ | 16× the energy of SF7 |

**SF9 chosen.** It gives comfortable margin over a same-field link with
vegetation in the path, while keeping airtime and transmit energy modest. SF7
would work but leaves little headroom for a wet summer with the crop grown tall,
or for an antenna knocked out of alignment. SF12 buys range that is not needed
and costs nearly an order of magnitude more transmit energy.

### Bandwidth

**125 kHz (chosen)** — the standard LoRa bandwidth and the best-supported
choice. Narrower bandwidths increase sensitivity but demand tighter frequency
stability, and crystal drift over a −10 °C to +50 °C enclosure swing becomes a
real concern. Wider bandwidth would reduce airtime at the cost of sensitivity,
which is not the trade needed here.

### Coding rate

**CR 4/5 (chosen)** — the lightest forward error correction. Higher rates
(4/6, 4/7, 4/8) add redundancy and airtime. With CRC enabled, a corrupted packet
is detected and discarded rather than believed, and a lost reading is acceptable
for a slowly-varying quantity ([ADR-0012](0012-thirty-minute-interval.md)).
Spending airtime to rescue marginal packets is not worthwhile when the next one
arrives in 30 minutes.

### Transmit power

**14 dBm (chosen)** — the EU ERP limit for this band, and the maximum legally
available. The SX1276 can deliver 17 dBm or more via its PA_BOOST pin, but that
would be non-compliant, and transmit energy scales with it. 14 dBm is both the
legal ceiling and, conveniently, the sensible engineering choice.

### Sync word

**0x12** — the conventional value for private (non-LoRaWAN) networks. 0x34 is
reserved for LoRaWAN and must be avoided so as not to interfere with, or be
disturbed by, any LoRaWAN traffic in the area.

## Decision

| Parameter | Value |
|---|---|
| Frequency | 868.1 MHz (sub-band g1) |
| Modulation | LORA |
| Spreading factor | 9 |
| Bandwidth | 125 kHz |
| Coding rate | CR_4_5 |
| TX power | 14 dBm |
| Sync word | 0x12 |
| CRC | enabled |
| Preamble | 8 symbols (default) |

## Consequences

- **Duty cycle is a non-issue.** Two ~90 ms packets per hour is **0.005 %**
  against a 1 % allowance — a 200-fold margin. Even SF12 at a 5-minute interval
  would remain legal. This constraint will never bind, and can be forgotten.
- Transmit energy is ~1.9 µAh per packet, under 7 % of the per-cycle budget.
  The DS18B20's conversion costs three times more. Optimising the radio further
  would be optimising the wrong term.
- **CRC enabled means corrupted packets are silently dropped**, not delivered as
  garbage. Combined with the encryption and rolling code
  ([ADR-0016](0016-packet-transport-security.md)), a delivered packet can be
  trusted.
- Both antennas should be **½-wave 868 MHz whips, mounted vertically and high**,
  with a clear line of sight. Antenna placement affects link margin more than
  any parameter above; a well-placed SF7 link beats a badly-placed SF12 one.
- **RSSI and SNR are exposed per packet** by the `sx127x` component. Log them.
  If RSSI trends toward −120 dBm, the margin is being consumed and SF10 is the
  remedy — a one-line change on both ends.
- If the link proves marginal in practice, the escalation order is: check
  antennas and mounting first, then raise the spreading factor, and only then
  consider a directional antenna. Raising TX power is not an option; it is
  already at the legal maximum.
