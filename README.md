# Automated Fertigation System

Portable, solar-powered fertigation controller. Waters while injecting humic acid (e.g. potassium humate) and micro-organisms into the supply. Portable so it cannot be stolen.

The browser dashboard and its server live in [`web/`](web/); deployment is self-contained under [`deploy/`](deploy/).

## Hardware

- KinCony KC868-A8 v1.7 — ESP32 (WROOM-32), 8 relays and 8 digital inputs via PCF8574 I2C expanders, YF-B5 flow sensor on GPIO14 (sensor header S1)
- Vechline solar panel — 100Wp, 18.35V / 5.45A rated, 22.7V open circuit
- Victron Energy MPPT 100|20 charge controller
- LiFePO4 battery — 12V 8Ah (96Wh), BMS limits 8A charge / 10A discharge, charge temperature 0–55°C, 3000+ cycles
- Seaflo diaphragm pump SFDP1-030-055-42 — 12V, 11.3 LPM open flow, 3.5A (7.5A max), 3.8 bar pressure switch
- 12V electrovalves
- Victron Energy SmartShunt — battery monitor, read over BLE (see Battery monitoring)

Network is WiFi with a fallback AP (`kc868-a8`); MQTT broker and OTA are configured. The board also has LAN8720 Ethernet, unused — ESPHome does not allow `ethernet:` and `wifi:` in the same config.

## Power budget

> [!IMPORTANT]
> The Victron MPPT 100|20 defaults to 20A charge current, but the battery accepts at most 8A — and the panel can briefly exceed its 100W rating (cold cells, edge-of-cloud). **Set the maximum charge current to 7A in VictronConnect before connecting the battery.**

Consumption at 12.8V: board idle (WiFi + MQTT + web server) ~0.13A; each energized relay ~40mA; a held-open electrovalve ~0.5A; pump ~3.5–4A pumping, up to 7.5A near its 3.8 bar cutoff.

- One default sequence (5/20/5 min): ~2.1Ah ≈ 27Wh — about a quarter of the battery.
- Battery alone, no sun: ~3 sequences back-to-back, or ~1.7h of continuous pumping.
- Standby: ~3Ah/day, so a full battery holds the idle electronics for ~2–2.5 days of zero sun.
- With sun this is a non-issue: one sequence is recovered in ~20–40 min of decent sunlight. The battery is a night/cloud buffer, not the energy source. Prefer irrigating during or right after daylight.

Operating limits:

- **Discharge margin is thin.** Normal pumping totals ~4.5A, but near the pump's pressure cutoff the total reaches ~8.2A against a 10A BMS — with no headroom for restart inrush. Size the drip network open enough that the pump runs well below cutoff and does not pressure-cycle; supervise one full sequence before trusting it unattended. If the BMS ever trips, the fix is a battery with a 20A+ BMS.
- **Never charge below 0°C** — LiFePO4 is damaged by sub-zero charging and it is unconfirmed whether this pack's BMS blocks it. A frosty night followed by dawn sun is exactly the failure case: insulate the battery enclosure or bring it in over winter.
- Nothing disconnects the load at low battery yet. The MPPT 100|20 load output has a configurable low-voltage disconnect — wire the pump and controller through it. The SmartShunt provides monitoring only; no automation acts on it yet.

## Battery monitoring

A Victron SmartShunt broadcasts its measurements as AES-encrypted BLE advertisements ("instant readout"); the ESP32 listens passively — no pairing, no wiring, read-only, and VictronConnect on the phone keeps working in parallel. Decoding uses the [esphome-victron_ble](https://github.com/Fabian-Schmidt/esphome-victron_ble) external component, pinned to a tag so the trusted code cannot change silently.

Exposed sensors: `Battery Voltage`, `Battery Current`, `Battery State of Charge`, `Battery Consumed Ah`, `Battery Time Remaining`.

The shunt's MAC address and encryption key live in `secrets.yaml` (`smartshunt_mac`, `smartshunt_bindkey`). To obtain them: VictronConnect (v5.93+) → SmartShunt → Settings → Product info → enable *Instant readout via Bluetooth* → *Instant readout details* → SHOW. Replace the placeholders, re-encrypt `secrets.enc.yaml`, reflash.

Power cost of listening: ~0.2–0.4W at the battery (shared WiFi/BLE radio, ~10% scan duty cycle), which trims zero-sun standby from ~2.5 to ~2.2 days. The shunt itself draws <1mA.

## Battery charging

Charging is fully automatic; nothing needs to be done when the battery is full. The MPPT runs bulk (full current, voltage rising) → absorption (holds ~14.2V, current tapers) → float (~13.5V, maintenance). LiFePO4 sits in float indefinitely without harm.

One-time configuration:

- MPPT (VictronConnect): LiFePO4 preset, **maximum charge current 7A** (see the callout above).
- SmartShunt (VictronConnect → Settings → Battery): capacity **8Ah**, charged voltage **14.0V**, tail current 4%, charged detection time 3 min, Peukert **1.05**, charge efficiency **99%**, discharge floor 20%. Defaults are for lead-acid; SoC is meaningless without these.

How "charged" is detected: voltage above 14.0V with current under ~0.32A (4% of 8Ah) for 3 minutes. The shunt then syncs SoC to 100% and resets Consumed Ah to 0. Until the first such sync after power-up, the SoC percentage is not trustworthy — read voltage and current instead. Signatures on the dashboard: bulk = steady amps; near-full = current tapering despite good sun; float = ~13.5V, near 0A.

The firmware mirrors the same detection in the `Battery Charged` binary sensor and publishes `ON` to `kc868-a8/battery/charged` each time a charge cycle completes. The sensor drops back to OFF when the MPPT falls to float; the MQTT event fires on the transition.

## Relay mapping

All 8 relays are in use: the pump, three sources upstream and four output channels downstream. There is no spare, and a fifth channel needs a second PCF8574 (see [controller ADR-0015](controller/docs/adr/0015-eight-relays-three-sources-four-zones.md)).

An output channel is just a numbered valve; *which place* it waters is a Zone, assigned on the server (see [web ADR-0014](web/docs/adr/0014-output-channels-are-generic-zones-are-server-entities.md)). The firmware never interprets a channel, so re-plumbing one to a different part of the plot needs no reflash.

| Relay | PCF8574 pin | Entity | Function |
|---|---|---|---|
| 1 | 7 | `Pump` | Seaflo diaphragm pump |
| 2 | 6 | `Fertigation Valve` | Source: water carrying the humate |
| 3 | 5 | `Clean Water Valve` | Source: clean water, used to pre-wet and flush |
| 4 | 4 | `Microbiology Valve` | Source: micro-organisms (manual only, not yet in the sequence) |
| 5 | 0 | `Output 1` | Output channel valve |
| 6 | 1 | `Output 2` | Output channel valve |
| 7 | 2 | `Output 3` | Output channel valve |
| 8 | 3 | `Output 4` | Output channel valve |

Exactly one source and one output channel are open at a time: one source so the tanks cannot back-feed each other, one channel so the single common-line flow sensor meters it unambiguously.

All relays use `restore_mode: ALWAYS_OFF`: after a power loss everything comes up off.

**The pump requires an open path on both sides** — one open source *and* one open output channel ([ADR-0016](controller/docs/adr/0016-pump-requires-open-path-both-sides.md)). Closing the last valve on either side stops the pump, and a start with no path is refused outright rather than left to the dry-run watchdog: deadheading drives the pump toward its 3.8 bar cutoff current (~7.5 A) against a 10 A BMS. `Selected Output` and the selected source persist across reboots, so the manual button still knows where to send water with no wifi.

## Automation

One automation exists: the irrigation sequence (`script: irrigation_sequence` in `controller/kc868-a8.yaml`). Started by button, MQTT or a schedule entry coming due, it runs three phases and shuts everything down by itself — there is no state in which the sequence ends with the pump running. It waters one channel with one **cycle recipe**, both handed to it as parameters ([ADR-0018](controller/docs/adr/0018-the-controller-schedules-and-the-recipe-travels-with-the-run.md)), so nothing a run does leaks into the next one.

| Phase | Duration | Pump | Fertigation valve | Clean water valve | Purpose |
|---|---|---|---|---|---|
| 1. Pre-wet | `Cycle Minutes` or `Cycle Liters` × `Pre-wet Percent` (default 5 min) | on | off | on | Prime the lines; the biology lands on moist soil |
| 2. Fertigation | Remaining cycle total (default 20 min) | on | on | off | Water with the fertigation substance |
| 3. Flush | `Flush Minutes` (default 5, min 1) | on | off | on | Clear humate/micro-organism residue from pump, lines, emitters |
| Shutdown | — | off | off | off | |

`Cycle Mode` chooses Time or Volume. The independent `Cycle Minutes` (default 25) and `Cycle Liters` (default 100) totals are retained when switching modes; `Pre-wet Percent` (default 20%, in 5% steps) allocates the pre-wet portion and fertigation always receives the remainder. The flush is deliberately outside that split and always time-based.

Those entities are the **default recipe**: what the physical button waters with, since a button has no payload to carry one, and the values the dashboard proposes a new irrigation with. They are *not* what a commanded or scheduled run uses — each of those carries its own.

## Scheduling

The controller holds the schedule and fires it from its own DS3231, so watering carries on through the weeks it has no WiFi. Entries are authored on the dashboard, stored in the server's SQLite, and published as a whole retained set on `kc868-a8/schedule/set`; the device keeps a copy in NVS (max 16). See [ADR-0018](controller/docs/adr/0018-the-controller-schedules-and-the-recipe-travels-with-the-run.md) and [web ADR-0017](web/docs/adr/0017-schedules-are-server-authored-and-device-fired.md).

An entry is a complete instruction: a time of day, a frequency, the output channel, and the cycle recipe. Frequency is either a set of weekdays or every N days from a fixed start date — never both, and both are pure functions of the calendar date, so a power cut or three weeks dark changes nothing. Entries are immutable: changing one means deleting it and creating another.

The device scans every 20 s and fires an entry whose hour and minute match, once per minute at most. If an entry's turn comes while the controller is already watering, it is **skipped** rather than queued, and recorded in the watering log with zero litres — a zone that silently went unwatered is a question the history has to be able to answer. Nothing fires while the RTC has no valid time.

Rules built into the sequence:

- Valve handovers overlap 2s, and the pump stops before the last valve closes: the running pump always has an open source. The pump's 3.8 bar pressure switch is only the backstop.
- The flush phase cannot be set below 1 minute — the residue-free guarantee is not optional.
- A start while a sequence is running is ignored (`mode: single`).
- A zero cycle total or zero-percent phase is skipped without opening its valves.

Cycle settings are `select`/`number` entities, adjustable at runtime from the web UI, Home Assistant, or MQTT; values survive reboots (`restore_value`).

Stopping (empty tank, knocked-over line, any reason) normally goes through `abort_irrigation`: stop the sequence, pump off, 2s, both valves off. The stop button and MQTT stop topic both use that immediate stop. The flow sensor's `Min Flow` watchdog is phase-aware: low flow during fertigation switches to clean water and completes a full recovery flush; low flow during pre-wet, flush, manual operation, or that recovery flush stops dead through `abort_irrigation`. See [docs/flow-sensor.md](docs/flow-sensor.md). Further planned options are a tank float switch and pump current sensing (INA226 + shunt on the I2C bus — pump on but under ~2A sustained means it is not moving water; also yields battery voltage). Either would just call `abort_irrigation`.

## Control

Web UI: `http://kc868-a8.local` (auth: `web_server_user` / `web_server_password` secrets). Works in the field through the fallback AP. Buttons: `Start Irrigation`, `Stop Irrigation`, and `Reset Total Water`. The button entity carries neither channel nor recipe, so it waters the selected output with the default recipe and refuses when no output is selected; MQTT names both explicitly. Native reset acts immediately only when the pump is off and flow is known below 0.1 L/min.

**Total Water** is cumulative litres since the last reset. It persists across normal reboots. Resetting it is irreversible and is explicitly written to preferences before success is reported.

MQTT (any payload except the start, which carries the channel and the recipe — see [ADR-0017](controller/docs/adr/0017-the-channel-travels-with-the-start.md) and [ADR-0018](controller/docs/adr/0018-the-controller-schedules-and-the-recipe-travels-with-the-run.md)):

```bash
# volume 1 = Volume mode (total in litres), 0 = Time (total in minutes)
mosquitto_pub -h 10.0.20.20 -u mosquitto -P <password> -t kc868-a8/irrigation/start \
  -m '{"channel":2,"volume":1,"total":200,"prewet":20,"flush":5}'
mosquitto_pub -h 10.0.20.20 -u mosquitto -P <password> -t kc868-a8/irrigation/stop -m ON
mosquitto_pub -h 10.0.20.20 -u mosquitto -P <password> -t kc868-a8/flow/reset_total/request -m ON
```

A start naming no output channel (1–4), or a flush below one minute, is refused and logged — never sent to whichever valve was last left open, and never completed from device state.

A reset request publishes one non-retained result on `kc868-a8/flow/reset_total/result`: `success`, `already_zero`, `rejected_pump_running`, `rejected_flow_active`, `rejected_flow_unknown`, or `error_persistence`. The last result means the RAM value is zero but it may not survive reboot.

`Irrigation Running` (binary sensor) reports whether a sequence is active.

A physical button on the board also starts/stops irrigation with no WiFi or MQTT; see [docs/manual-pump-button.md](docs/manual-pump-button.md).

## Layout

The firmware and its secrets are self-contained under `controller/`:

```
controller/kc868-a8.yaml       # device config
controller/secrets.yaml        # plaintext secrets (gitignored)
controller/secrets.enc.yaml    # age-encrypted secrets (committed)
controller/.age-recipients     # age public key, derived from ~/.ssh/id_dev
```

Secrets follow the same scheme as [my-esphome](https://github.com/masolnada/my-esphome) and hold the same values.

## Setup

Decrypt the secrets:

```bash
age --decrypt --identity ~/.ssh/id_dev --output controller/secrets.yaml controller/secrets.enc.yaml
```

After editing `controller/secrets.yaml`, re-encrypt and commit:

```bash
age --encrypt -R controller/.age-recipients -o controller/secrets.enc.yaml controller/secrets.yaml
```

This repo has no ESPHome install of its own; use the venv from `../my-esphome`:

```bash
../my-esphome/.venv/bin/esphome config controller/kc868-a8.yaml
```

## Flashing

### OTA (normal case)

The device answers at `kc868-a8.local` (currently 10.0.20.70, DHCP-assigned):

```bash
../my-esphome/.venv/bin/esphome run controller/kc868-a8.yaml --device kc868-a8.local
```

### USB (first flash or broken OTA)

USB flashing must run natively. The ESPHome container is useless here: Podman on macOS does not forward USB-serial devices, so the dashboard inside it will never list the port.

1. Connect the board's USB-C port to the Mac. A monitor USB hub in between is fine. The onboard CH340 uses macOS's built-in driver; no install needed.

2. Find the port:

   ```bash
   ls /dev/cu.usbserial-*
   ```

   If nothing appears, suspect the cable (charge-only USB-A-to-C cables are common) before anything else.

3. Flash:

   ```bash
   ../my-esphome/.venv/bin/esphome run controller/kc868-a8.yaml --device /dev/cu.usbserial-XXXXXX
   ```

The board has auto-reset circuitry: no manual bootloader mode (GPIO0 to GND) is required, unlike the Shelly boards in my-esphome.

## Logs

```bash
../my-esphome/.venv/bin/esphome logs controller/kc868-a8.yaml --device kc868-a8.local
```
