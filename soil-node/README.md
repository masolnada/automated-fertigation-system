# Soil Node — Watermark soil tension sensor over LoRa

A battery-powered, solar-free sensor node that reads two Irrometer Watermark
200SS soil moisture sensors plus soil temperature, converts the readings to soil
water tension (kPa), and transmits them over LoRa every 30 minutes to the
KC868-A8 fertigation controller, which republishes them to MQTT.

The node exists to answer one question with real data: **when does this soil
actually need water?** Until that data exists, irrigation is scheduled blind.

```
  ┌──────────────────────┐        868 MHz          ┌──────────────────┐
  │  Soil node (field)   │  LoRa SF9, 30 min       │  KC868-A8        │
  │  ESP32-C3 + SX1276   │ ──────────────────────► │  gateway         │
  │  3x AA lithium       │  encrypted, 1-way       │  SX1276 receiver │
  └──────────────────────┘                         └────────┬─────────┘
     2x Watermark 200SS                                     │ MQTT (wifi)
     1x DS18B20                                             ▼
                                                   ┌──────────────────┐
                                                   │  Mosquitto       │
                                                   │  → Grafana       │
                                                   │  → automations   │
                                                   └──────────────────┘
```

Every design decision is recorded in [`adr/`](adr/) — read
[`adr/README.md`](adr/README.md) for the index. The build and firmware plan is
in [`plan.md`](plan.md).

## Status

**Design complete, nothing built.** This folder currently contains the
engineering documentation you design the PCB and write the firmware from. No
`soil-node.yaml` exists yet; see [`plan.md`](plan.md).

## The sensor

The Watermark 200SS (sold in Spain by [Copersa](https://riegos.copersa.com/))
is a granular matrix sensor: two concentric electrodes embedded in a porous
material that equilibrates with the surrounding soil. Electrically it is nothing
but **a variable resistor**, roughly 550 Ω when saturated and 30 kΩ+ when dry,
covering 0–239 kPa.

It has three non-negotiable requirements, and ignoring any of them gives wrong
readings and a dead sensor within a season:

1. **Alternating-polarity excitation**, pulses under 50 ms. Sustained DC plates
   ions onto one electrode: the reading drifts and the electrode erodes.
2. **Temperature compensation.** The resistance-to-tension conversion is
   temperature dependent — about 1.8 % error per °C away from 24 °C.
3. **Galvanic isolation between sensors.** Wet soil conducts. Two sensors
   sharing a ground path measure partly through each other's electrodes.

The design addresses these in [ADR-0007](adr/0007-h-bridge-divider-per-sensor.md),
[ADR-0008](adr/0008-ds18b20-soil-temperature.md) and again in
[ADR-0007](adr/0007-h-bridge-divider-per-sensor.md) respectively.

## Reading circuit

Per sensor: two GPIOs, one precision resistor, one ADC channel. No multiplexer,
no transistors — the GPIOs themselves form the bridge.

```
        P ──[ Rx 10k 0.1% ]──┬──[ Watermark Rs ]── N
                             │
                             └── ADS1115 AINx
```

| Phase | P | N | Measured |
|---|---|---|---|
| Direction 1 | 3.3 V | 0 V | `V1`, sensor is low-side leg |
| Direction 2 | 0 V | 3.3 V | `V2`, sensor is high-side leg |
| Idle | high-Z | high-Z | nothing — sensor fully floating |

```
Rs_A = Rx * V1 / (Vs - V1)          # direction 1
Rs_B = Rx * (Vs - V2) / V2          # direction 2
Rs   = (Rs_A + Rs_B) / 2            # net zero DC charge on the sensor
```

Averaging the two directions is what makes the excitation "pseudo-AC": equal
time in each polarity leaves no accumulated charge. It also cancels first-order
offsets in the drive and the ADC.

**The idle state is the isolation.** Between readings both pins go to INPUT
(high-Z), so the sensor not being read has no return path through the soil to
the one being read. This is the job a 74HC4052 multiplexer does in Irrometer's
own reference circuit, done here with pin direction instead of a chip
([ADR-0007](adr/0007-h-bridge-divider-per-sensor.md)).

Peak current through a saturated sensor is ~310 µA — trivial for a 40 mA-rated
pin, and it lasts milliseconds.

## Resistance to tension

Irrometer's piecewise conversion, with the Shock 1998 equation at its core.
`R` in kΩ, `T` in °C, result in kPa (= centibars):

```
kPa = (-3.213 * R - 4.093) / (1 - 0.009733 * R - 0.01205 * T)
```

Dr. Clinton Shock (Oregon State University, 1998) derived this empirically by
logging Watermark sensors alongside tensiometers — accurate instruments that
need constant maintenance. The equation lets a cheap maintenance-free sensor
stand in for an expensive fussy one. It is validated for 10–100 kPa; outside
that range Irrometer's firmware switches equations, which is why the conversion
is piecewise:

| Resistance | Branch | Meaning |
|---|---|---|
| ≥ 35 kΩ or 0 | **255** (sentinel) | open circuit — sensor absent or cable cut |
| > 8 kΩ | `(-2.246 - 5.239*R*tc - 0.06756*R²*tc²)` | very dry, Shock's fit degrades here |
| 1–8 kΩ | **Shock 1998** (above) | the validated core range |
| 550 Ω – 1 kΩ | `(R * 23.156 - 12.736) * tc` | near saturation |
| 300–550 Ω | 0 kPa | saturated, or a brand-new sensor |
| < 300 Ω | **240** (sentinel) | sensor terminals shorted |

where `tc = 1.00 + 0.018 * (T - 24.00)`.

**Higher kPa means drier** — the number is suction, how hard roots must pull.
This is counterintuitive on a dashboard and worth a note on the Grafana panel.

| kPa | Interpretation |
|---|---|
| 0–10 | Saturated |
| 10–30 | Comfortably moist |
| 30–60 | Typical irrigation trigger for vegetables |
| 60–100 | Dry, plants stressed |
| > 100 | Serious deficit |

The exact threshold is crop- and soil-dependent. Logging comes first precisely
so it can be derived from real data rather than guessed
([ADR-0001](adr/0001-logging-only-scope.md)).

## Bill of materials

Quantities are for one node.

### Core

| Ref | Part | Qty | Notes |
|---|---|---|---|
| U1 | ESP32-C3-MINI-1-N4 | 1 | Bare module, not a dev board ([ADR-0005](adr/0005-esp32-c3-bare-module.md)) |
| U2 | TPS7A0233PDBVR | 1 | 3.3 V LDO, 25 nA quiescent ([ADR-0010](adr/0010-tps7a02-ldo.md)) |
| U3 | ADS1115IDGSR | 1 | 16-bit I2C ADC ([ADR-0007](adr/0007-h-bridge-divider-per-sensor.md)) |
| U4 | RFM95W-868S2 or Ra-01H | 1 | SX1276 LoRa module, 868 MHz ([ADR-0004](adr/0004-spi-sx1276-radio.md)) |
| — | SMA edge connector + ½-wave 868 MHz whip | 1 | |

### Sensor front end

| Ref | Part | Qty | Notes |
|---|---|---|---|
| R1, R2 | 10 kΩ **0.1 %** metal film, 25 ppm/°C | 2 | Series resistor Rx — tolerance feeds directly into the result |
| D1–D4 | SMAJ5.0CA bidirectional TVS | 4 | One per Watermark conductor. Non-optional: these cables are a direct conductive path from wet earth into the board |
| R3, R4 | 100 Ω | 2 | Series protection between TVS and GPIO |
| — | DS18B20, waterproof stainless probe, 3 m lead | 1 | Soil temperature ([ADR-0008](adr/0008-ds18b20-soil-temperature.md)) |
| R5 | 4.7 kΩ | 1 | DS18B20 1-Wire pull-up |

### Battery sense

| Ref | Part | Qty | Notes |
|---|---|---|---|
| Q1 | 2N7002 N-channel MOSFET | 1 | Gates the divider so it draws nothing while asleep |
| R6 | 1 MΩ | 1 | Divider high side |
| R7 | 470 kΩ | 1 | Divider low side — scales 5.4 V max to ~1.73 V |
| C1 | 100 nF C0G | 1 | Sampling reservoir |

### Power

| Ref | Part | Qty | Notes |
|---|---|---|---|
| BT1 | 3× AA holder, PCB mount | 1 | For Energizer L91 lithium ([ADR-0009](adr/0009-aa-lithium-battery.md)) |
| — | Energizer L91 Ultimate Lithium AA | 3 | −40 to +60 °C, 20-year shelf life |
| C2 | 100 µF tantalum/polymer | 1 | Bulk, absorbs the LoRa TX current step |
| C3, C4 | 10 µF X7R | 2 | LDO in/out |
| C5–C8 | 100 nF X7R | 4 | Decoupling: MCU, ADC, radio |

### Enclosure

| Part | Notes |
|---|---|
| IP67 ABS/polycarbonate enclosure | Must survive Cardona winters and summer sun |
| M12 cable glands ×3 | Two Watermark, one DS18B20 — **all on the same face**, downward |
| Gore vent / breather membrane | Condensation cycling in and out of freezing is what actually kills field boxes |
| Silica gel sachet | Replace when the batteries are swapped |

## Netlist

Every connection, explicit. Draw the schematic from this.

### Power rail

```
BT1+ (3x AA, 5.4 V fresh -> ~3.4 V exhausted)
  ├── C2 (100 µF) ── GND
  ├── U2.IN (TPS7A02)
  └── R6 (1 MΩ) ── node VBAT_SENSE
U2.EN ──── U2.IN                     # always enabled; 25 nA costs nothing
U2.OUT ── 3V3 rail
  ├── C3, C4 (10 µF)  ── GND
  ├── U1.3V3   (+ C5 100 nF)
  ├── U3.VDD   (+ C6 100 nF)
  ├── U4.VCC   (+ C7 100 nF, + C8 100 nF)
  └── R5 (4.7 kΩ) ── DS18B20 data
BT1- ──── GND (single-point star ground under U1)
```

### ESP32-C3 to SX1276 (SPI)

| ESP32-C3 | Signal | SX1276 |
|---|---|---|
| GPIO2 | SCK | SCK |
| GPIO3 | MOSI | MOSI |
| GPIO10 | MISO | MISO |
| GPIO6 | CS (NSS) | NSS |
| GPIO7 | RST | RESET |
| GPIO8 | DIO0 | DIO0 |

`DIO0` is wired even though the ESPHome `dio0_pin` key is optional — on the
transmit side it lets the radio signal TX-done instead of the MCU waiting a
fixed worst-case delay, which directly shortens the awake window.

### ESP32-C3 to ADS1115 (I2C)

| ESP32-C3 | Signal | ADS1115 |
|---|---|---|
| GPIO4 | SDA | SDA (+ 4.7 kΩ pull-up to 3V3) |
| GPIO5 | SCL | SCL (+ 4.7 kΩ pull-up to 3V3) |
| — | address | ADDR → GND = **0x48** |

### Watermark sensor 1

```
GPIO0 ── R3 (100 Ω) ──┬── D1 (TVS to GND) ── Watermark 1 lead A     # P1
                      └── R1 (10 kΩ 0.1%) ──┬── ADS1115.AIN0
                                            └── (junction)
Watermark 1 lead B ──┬── D2 (TVS to GND) ── R? ── GPIO1              # N1
```

More precisely, the divider is: `GPIO0 (P) — R1 — junction — sensor — GPIO1 (N)`,
with the junction tapped by `ADS1115.AIN0` and TVS clamps on both conductors
where they leave the board.

### Watermark sensor 2

Identical, with `GPIO20 (P)`, `GPIO21 (N)`, series resistor R2, junction to
`ADS1115.AIN1`, TVS D3/D4.

### DS18B20

```
GPIO9 ──┬── R5 (4.7 kΩ) ── 3V3
        └── DS18B20 DATA (yellow)
3V3 ────── DS18B20 VDD  (red)
GND ────── DS18B20 GND  (black)
```

### Battery sense

```
BT1+ ── R6 (1 MΩ) ──┬── ADS1115.AIN2
                    ├── C1 (100 nF)
                    └── R7 (470 kΩ) ── Q1.drain
Q1.source ── GND
Q1.gate ──── GPIO18        # HIGH only during the reading window
```

With the MOSFET off, the divider is open and draws nothing. With it on, the
ratio is `470k / (1M + 470k) = 0.3197`, mapping 5.4 V to 1.73 V — inside the
ADS1115's ±2.048 V range with headroom.

### GPIO summary — node

| GPIO | Function | Notes |
|---|---|---|
| 0 | Watermark 1 P | Strapping pin — high-Z at boot, safe |
| 1 | Watermark 1 N | |
| 2 | SPI SCK | Strapping pin — must be low at boot; SPI idles low |
| 3 | SPI MOSI | |
| 4 | I2C SDA | |
| 5 | I2C SCL | |
| 6 | SX1276 CS | |
| 7 | SX1276 RST | |
| 8 | SX1276 DIO0 | Strapping pin — needs pull-up; radio drives it low when idle |
| 9 | DS18B20 1-Wire | Strapping pin — 4.7 kΩ pull-up satisfies boot requirement |
| 10 | SPI MISO | |
| 18, 19 | USB D-/D+ | Reserve for programming and console |
| 20 | Watermark 2 P | UART RX by default; usable as GPIO |
| 21 | Watermark 2 N | UART TX by default; usable as GPIO |

**GPIO18 conflict:** the battery-sense MOSFET gate is listed above on GPIO18,
which is also USB D-. Move it to a free pin during schematic capture — GPIO20
and GPIO21 are taken by Watermark 2, so this needs resolving before layout. See
`plan.md`, open item 3.

## GPIO changes on the gateway (KC868-A8)

The A8 has almost no free pins. Audit of the v1.7 board:

| Pins | Status |
|---|---|
| GPIO4, GPIO5 | I2C — both PCF8574 expanders (`controller/kc868-a8.yaml:36`). Untouchable |
| GPIO14 | YF-B5 flow sensor (`controller/kc868-a8.yaml:562`) |
| GPIO13 | DS18B20 (`controller/kc868-a8.yaml:508`) — **reclaimed**, see [ADR-0015](adr/0015-reclaim-gpio13-on-gateway.md) |
| GPIO32, GPIO33 | Free (headers S3/S4). 10 kΩ pull-ups present, harmless for SPI |
| GPIO2, GPIO15 | Free (unpopulated 433 MHz header). Both strapping pins |
| GPIO34, GPIO35 | A1/A2 — **unusable.** They sit on LM258 op-amp *outputs*, which would fight anything driven and swamp a MISO signal |
| GPIO0, 17, 18, 19, 21, 22, 23, 25, 26, 27 | LAN8720 Ethernet PHY. PHY *outputs* are hard-blocked even with Ethernet unused |

SPI needs 5 pins minimum (SCK, MOSI, MISO, CS, RST). Only 4 were free, hence
the DS18B20 relocation.

| A8 GPIO | Signal | Rationale |
|---|---|---|
| GPIO15 | SCK | Strapping pin, must be low at boot — SPI clock idles low |
| GPIO13 | MOSI | Freed from DS18B20 |
| GPIO2 | MISO | Strapping pin. The radio only drives it while CS is low, so it floats at boot |
| GPIO32 | CS | Ordinary GPIO, no boot constraint |
| GPIO33 | RST | Ordinary GPIO |
| — | DIO0 | Omitted. One packet per 30 minutes does not need interrupt-driven RX |

> **Unverified.** This assumes the v1.7 board matches the published KinCony
> pinout. Do a continuity check from the headers to the ESP32 pins before
> soldering anything.

## Power budget

Per 30-minute cycle:

| Phase | Current | Duration | Charge |
|---|---|---|---|
| Boot + ESPHome init (no WiFi) | ~30 mA | 1.5 s | 12.5 µAh |
| DS18B20 conversion (12-bit) | ~30 mA | 0.75 s | 6.3 µAh |
| 2 sensors × 2 directions, ADS1115 | ~30 mA | 0.05 s | 0.4 µAh |
| LoRa TX, ~40 bytes SF9 @ 14 dBm | ~45 mA | 0.15 s | 1.9 µAh |
| **Active subtotal** | | ~2.5 s | **~21 µAh** |
| Deep sleep (C3 ~5 µA + ADS1115 ~2 µA + LDO + leakage ≈ 15 µA) | 15 µA | 1797 s | 7.5 µAh |
| **Per cycle** | | | **~28.5 µAh** |

- **Per day:** 48 cycles × 28.5 µAh ≈ **1.4 mAh**
- **Per year:** ≈ **0.5 Ah**
- **3× L91 capacity:** ~3000 mAh at 4.5 V nominal

Theoretical runtime is far beyond the batteries' useful life; **expect 3+ years,
limited by self-discharge (~1 %/year) and cell chemistry rather than by load.**

Note that sleep and active current are within a factor of three of each other in
total contribution. This is why the LDO choice matters more than the radio
settings: a commodity AMS1117 at 5 mA quiescent would draw 120 mAh/day —
**85× the entire budget** — and flatten the pack in under a month. This is the
single most common way low-power nodes fail
([ADR-0010](adr/0010-tps7a02-ldo.md)).

### Radio duty cycle

EU 868 MHz sub-band g1 (868.0–868.6 MHz) permits **1 % duty cycle**: 36 s of
airtime per hour. At SF9/125 kHz a ~40 byte packet is ~90 ms; two per hour is
**0.005 %** of the allowance. Duty cycle does not constrain this design at any
spreading factor under consideration.

## Field installation

- Install both Watermark sensors at **root depth**, in undisturbed soil, in a
  PVC access tube. Slurry the hole so the sensor makes full contact — an air gap
  reads permanently dry.
- **Soak new sensors** and let them dry once or twice before trusting readings.
  A dry new sensor reads like saturated soil (both are sub-550 Ω territory in
  the sentinel logic).
- Put the **DS18B20 at the same depth** as the Watermarks. Compensating with
  air temperature defeats the purpose.
- Mount both antennas high and vertical. Antenna placement affects link margin
  more than spreading factor does.
- Route all cable glands **downward on one face**; water finds every other path.

## Maintenance

| Interval | Task |
|---|---|
| Every reading | Watch for kPa = 255 (open circuit) or 240 (short) sentinels |
| Monthly | Check battery voltage trend in Grafana, not just its current value |
| Yearly | Reseat sensors, verify soil contact, replace silica gel |
| ~3 years | Replace the 3 AA cells |

## References

- [Irrometer developer guide — reading WATERMARK sensors](https://www.irrometer.com/200ss.html)
- [Watermark 200SS datasheet](https://irrometer.com/pdf/403.pdf)
- [Copersa Watermark catalogue (ES)](https://riegos.copersa.com/wp-content/uploads/2022/07/Copersa-%C2%B7-Sensores-Watermark.pdf)
- [ESPHome SX127x component](https://esphome.io/components/sx127x/)
- [ESPHome packet_transport component](https://esphome.io/components/packet_transport/)
- Shock, C.C. et al. (1998), calibration of Watermark sensors against tensiometers
