# Automated Fertigation System

Portable, solar-powered fertigation controller. Waters while injecting humic acid (e.g. potassium humate) and micro-organisms into the supply. Portable so it cannot be stolen.

## Hardware

- KinCony KC868-A8 v1.7 — ESP32 (WROOM-32), 8 relays and 8 digital inputs via PCF8574 I2C expanders, DS18B20 on GPIO14
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

| Relay | Entity | Function |
|---|---|---|
| 1 | `Pump` | Seaflo diaphragm pump |
| 2 | `Fertigation Valve` | Flow of water with the fertigation substance |
| 3 | `Clean Water Valve` | Clean water supply, used to flush the system |
| 4–8 | `Relay 4`–`Relay 8` | Spare |

Pump and valve relays use `restore_mode: ALWAYS_OFF`: after a power loss everything comes up off.

## Automation

One automation exists: the irrigation sequence (`script: irrigation_sequence` in `kc868-a8.yaml`). Started by button or MQTT, it runs three phases and shuts everything down by itself — there is no state in which the sequence ends with the pump running.

| Phase | Duration | Pump | Fertigation valve | Clean water valve | Purpose |
|---|---|---|---|---|---|
| 1. Pre-wet | `Pre-wet Minutes` (default 5) | on | off | on | Prime the lines; the biology lands on moist soil |
| 2. Fertigation | `Fertigation Minutes` (default 20) | on | on | off | Water with the fertigation substance |
| 3. Flush | `Flush Minutes` (default 5, min 1) | on | off | on | Clear humate/micro-organism residue from pump, lines, emitters |
| Shutdown | — | off | off | off | |

Rules built into the sequence:

- Valve handovers overlap 2s, and the pump stops before the last valve closes: the running pump always has an open source. The pump's 3.8 bar pressure switch is only the backstop.
- The flush phase cannot be set below 1 minute — the residue-free guarantee is not optional.
- A start while a sequence is running is ignored (`mode: single`).
- A phase set to 0 minutes degenerates to a ~4s valve transient.

Durations are `number` entities, adjustable at runtime from the web UI, Home Assistant, or MQTT; values survive reboots (`restore_value`).

Stopping (empty tank, knocked-over line, any reason) always goes through a second script, `abort_irrigation`: stop the sequence, pump off, 2s, both valves off. The stop button and the MQTT stop topic both call it. Automatic interrupts are not implemented yet; planned options are a tank float switch on input 1 and pump current sensing (INA226 + shunt on the I2C bus — pump on but under ~2A sustained means it is not moving water; also yields battery voltage). Either would just call `abort_irrigation`.

## Control

Web UI: `http://kc868-a8.local` (auth: `web_server_user` / `web_server_password` secrets). Works in the field through the fallback AP. Buttons: `Start Irrigation`, `Stop Irrigation`.

MQTT (any payload):

```bash
mosquitto_pub -h 10.0.20.20 -u mosquitto -P <password> -t kc868-a8/irrigation/start -m ON
mosquitto_pub -h 10.0.20.20 -u mosquitto -P <password> -t kc868-a8/irrigation/stop -m ON
```

`Irrigation Running` (binary sensor) reports whether a sequence is active.

## Layout

```
kc868-a8.yaml       # device config
secrets.yaml        # plaintext secrets (gitignored)
secrets.enc.yaml    # age-encrypted secrets (committed)
.age-recipients     # age public key, derived from ~/.ssh/id_dev
```

Secrets follow the same scheme as [my-esphome](https://github.com/masolnada/my-esphome) and hold the same values.

## Setup

Decrypt the secrets:

```bash
age --decrypt --identity ~/.ssh/id_dev --output secrets.yaml secrets.enc.yaml
```

After editing `secrets.yaml`, re-encrypt and commit:

```bash
age --encrypt -R .age-recipients -o secrets.enc.yaml secrets.yaml
```

This repo has no ESPHome install of its own; use the venv from `../my-esphome`:

```bash
../my-esphome/.venv/bin/esphome config kc868-a8.yaml
```

## Flashing

### OTA (normal case)

The device answers at `kc868-a8.local` (10.0.20.160):

```bash
../my-esphome/.venv/bin/esphome run kc868-a8.yaml --device kc868-a8.local
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
   ../my-esphome/.venv/bin/esphome run kc868-a8.yaml --device /dev/cu.usbserial-XXXXXX
   ```

The board has auto-reset circuitry: no manual bootloader mode (GPIO0 to GND) is required, unlike the Shelly boards in my-esphome.

## Logs

```bash
../my-esphome/.venv/bin/esphome logs kc868-a8.yaml --device kc868-a8.local
```
