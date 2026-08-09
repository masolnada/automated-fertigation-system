# A DS3231 RTC provides wall-clock time for offline event timestamps

Watering events need real timestamps, but the board has no clock — an ESP32 with
no `time:` platform knows only uptime, and SNTP needs internet the controller
usually lacks in the field. A battery-backed **DS3231** on the existing I2C bus
(0x68) keeps true wall-clock across the field power-cycles that a solar/battery
rig suffers, so every event gets an accurate date even after weeks offline.
ESPHome (2025.11) has no native DS3231 driver, so it is driven by the `ds1307`
platform — the DS3231's timekeeping registers are byte-identical to the DS1307's;
its temperature-compensated oscillator, alarms and temperature sensor go unused. SNTP is also configured and **writes back** to the RTC whenever the
controller is home with WiFi.

## Considered options

- **Uptime + boot-id, anchored server-side (rejected):** works with no hardware,
  but a month offline means repeated power-cycles, and only the final boot's
  events can be anchored to wall-clock — the rest get approximate dates, which is
  exactly the data the scheduling automations depend on.
- **SNTP alone (rejected):** no time in the field, and none after an offline
  reboot until it can reach a server.
- **DS3231 (chosen):** the only option that keeps accurate wall-clock through an
  offline power-cycle, and it simplifies the payload to real epoch `start`/`end`
  with no anchoring math.

## Consequences

The RTC must be synced once from NTP (controller home with WiFi) before the first
field trip; a fresh or dead-coin-cell RTC has no valid time until then. The
DS3231 shares `bus_a` (SDA 4 / SCL 5) with the PCF8574 expanders (0x22/0x24) — no
address conflict.
