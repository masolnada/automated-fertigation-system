# ADR-0005 — ESP32-C3-MINI-1 bare module as the node MCU

**Status:** Accepted

## Context

The node must read an I2C ADC, a 1-Wire temperature sensor, drive four GPIOs for
sensor excitation, run an SPI radio, and then sleep for 30 minutes drawing as
close to nothing as possible.

Two independent questions: which chip, and — more consequentially — a bare
module or a development board.

The second question turns out to matter more than the first.

## Options considered

### Chip

#### A. ESP32-C3 (chosen)

- **Pro:** ~5 µA deep sleep, the best of the three.
- **Pro:** Single RISC-V core at 160 MHz is far more than enough to read two ADC
  channels and push 40 bytes into a radio.
- **Pro:** Cheapest, and fully supported by ESPHome including `deep_sleep`.
- **Pro:** No PSRAM, no second core, no USB-OTG complexity — nothing that
  contributes quiescent current for a workload that does not need it.
- **Pro:** Native USB-Serial/JTAG on GPIO18/19, so programming and console need
  no external USB-UART chip on the board. That is one fewer part *and* one fewer
  source of sleep current.
- **Con:** Fewer GPIOs than the classic ESP32; the pin budget is tight but
  sufficient (see the netlist in `../README.md`).
- **Con:** Several pins are strapping pins with boot-time constraints, requiring
  care in assignment.

#### B. ESP32 classic (ESP32-WROOM-32)

- **Pro:** Already used on the KC868-A8, so the behaviour is familiar.
- **Pro:** More GPIOs, more headroom.
- **Con:** ~10–25 µA deep sleep, several times the C3, and higher active current
  for work that never needs two cores.
- **Con:** Larger and more expensive with no benefit to this workload.

#### C. ESP32-S3

- **Con:** Overkill on every axis. More power, more cost, more pins than needed,
  and PSRAM that this job has no use for. Rejected quickly.

### Form factor

#### D. Bare module on a custom PCB (chosen)

- **Pro:** Complete control of what draws current while asleep.
- **Pro:** Only the intended parts are on the board.

#### E. Development board (e.g. a XIAO or DevKitM-1)

- **Pro:** No PCB to design, immediate breadboarding, USB and regulator already
  present.
- **Con:** **This is where low-power projects die.** A typical dev board carries
  a USB-UART bridge (CH340, CP2102) drawing hundreds of µA to milliamps even
  idle, an AMS1117-class LDO at ~5 mA quiescent, and often a power LED at 1–3 mA.
  Together they can draw **1000× the sleeping MCU**, making the choice of MCU
  irrelevant.
- **Con:** Some boards can be modified — cutting the LED, desoldering the
  regulator — but that is unreliable surgery on a part not designed for it, and
  the result is neither reproducible nor documented.

Since a custom PCB was already acceptable ([ADR-0006](0006-custom-pcb.md)),
there is no reason to accept a dev board's parasitic loads.

## Decision

**ESP32-C3-MINI-1-N4**, the bare surface-mount module, on a custom PCB.

## Consequences

- Deep sleep current is set by the module (~5 µA), the LDO
  ([ADR-0010](0010-tps7a02-ldo.md)) and board leakage — not by anything
  incidental.
- **Strapping pins need care.** GPIO2, GPIO8 and GPIO9 have boot-time level
  requirements. The netlist in `../README.md` assigns them deliberately: SPI
  clock idles low on GPIO2, the radio holds DIO0 low on GPIO8, and the 1-Wire
  pull-up satisfies GPIO9.
- Programming uses the native USB-Serial/JTAG peripheral on GPIO18/19. **A USB
  connector must be reachable without opening the potted enclosure or
  desoldering**, because [ADR-0002](0002-lora-only-topology.md) rules out OTA
  entirely. Plan the mechanical design around this.
- The board needs the module's standard support circuitry: EN pull-up with an RC
  delay, and a boot button on GPIO9 for recovery flashing.
- Antenna keep-out matters. The MINI-1's PCB antenna is unused here (WiFi is
  off), but the SX1276's antenna feed and the SMA connector need a clean ground
  plane and a 50 Ω trace.
