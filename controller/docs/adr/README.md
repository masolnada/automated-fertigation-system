# Architecture Decision Records — Fertigation Controller

Decisions for the KC868-A8 firmware (`kc868-a8.yaml`). Each record is one decision
in 1–3 sentences: the context, what was decided, and why. See
[../../CONTEXT.md](../../CONTEXT.md) for the glossary and
[../../../CONTEXT-MAP.md](../../../CONTEXT-MAP.md) for the other contexts.

| # | Decision |
|---|---|
| [0001](0001-three-phase-self-terminating-sequence.md) | Irrigation is a three-phase, self-terminating sequence |
| [0002](0002-cycle-by-volume-or-time.md) | A cycle is sized by volume or time, with one split percentage |
| [0003](0003-volume-phase-bounded-only-by-watchdog.md) | A volume phase is bounded only by the Min Flow watchdog |
| [0004](0004-flow-sensor-on-common-line-after-pump.md) | The flow sensor sits on the common line, after the pump |
| [0005](0005-phase-aware-low-flow-watchdog.md) | The low-flow watchdog is phase-aware: fertigation recovers, else stop dead |
| [0006](0006-runtime-adjustable-flow-k-factor.md) | The flow K-factor is runtime-adjustable |
| [0007](0007-guarded-irreversible-total-water-reset.md) | Total Water reset is guarded, irreversible, persisted before success |
| [0008](0008-esp-idf-not-arduino.md) | ESP-IDF framework, not Arduino (BLE boot loop) |
| [0009](0009-smartshunt-passive-ble-monitoring-only.md) | SmartShunt is read passively over encrypted BLE, monitoring only |
| [0010](0010-power-path-external-constraints.md) | The power path is bounded by operator-set constraints |
| [0011](0011-watering-log-in-nvs-not-eeprom.md) | The on-device watering-event log lives in ESP32 NVS, not the AT24C32 EEPROM |
| [0012](0012-device-authoritative-watering-log.md) | The controller is the authoritative source of watering events |
| [0013](0013-ds3231-rtc-for-offline-timestamps.md) | A DS3231 RTC provides wall-clock time for offline event timestamps |
| [0014](0014-esphome-coupled-feature-headers.md) | Feature logic lives in ESPHome-coupled headers, not pure/testable cores |
| [0015](0015-eight-relays-three-sources-four-zones.md) | The relay budget fixes the system at three sources and four zones |
| [0016](0016-pump-requires-open-path-both-sides.md) | The pump requires an open path on both sides, not just upstream |
| [0017](0017-the-channel-travels-with-the-start.md) | The channel travels with the start, rather than being set beforehand |

If a decision is reversed, add a new ADR that supersedes the old one rather than
editing history.
