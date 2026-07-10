# automated-fertigation-system

Portable, solar-powered fertigation controller. Waters while injecting humic acid (e.g. potassium humate) and micro-organisms into the supply. Portable so it cannot be stolen.

## Hardware

- KinCony KC868-A8 v1.7 — ESP32 (WROOM-32), 8 relays and 8 digital inputs via PCF8574 I2C expanders, DS18B20 on GPIO14
- Vechline solar panel — 100Wp, 18.35V / 5.45A rated, 22.7V open circuit
- Victron Energy MPPT 100|20 charge controller
- LiFePO4 battery — 12V 8Ah (96Wh)
- Seaflo diaphragm pump SFDP1-030-055-42 — 12V, 11.3 LPM open flow, 3.5A (7.5A max), 3.8 bar pressure switch
- 12V electrovalves

Network is WiFi with a fallback AP (`kc868-a8`); MQTT broker and OTA are configured. The board also has LAN8720 Ethernet, unused — ESPHome does not allow `ethernet:` and `wifi:` in the same config.

## Relay mapping

| Relay | Entity | Function |
|---|---|---|
| 1 | `Pump` | Seaflo diaphragm pump |
| 2 | `Fertigation Valve` | Flow of water with the fertigation substance |
| 3 | `Clean Water Valve` | Clean water supply, used to flush the system |
| 4–8 | `Relay 4`–`Relay 8` | Spare |

Pump and valve relays use `restore_mode: ALWAYS_OFF`: after a power loss everything comes up off.

## Irrigation sequence

Started by button or MQTT, the sequence runs three phases. Valve handovers overlap 2s so the running pump always has an open source; the pump's 3.8 bar pressure switch is only the backstop.

1. **Pre-wet** — clean water. Primes the lines; the biology lands on moist soil.
2. **Fertigation** — water with the fertigation substance.
3. **Flush** — clean water again, so no humate or micro-organism residue remains in the pump, lines, or emitters. The flush duration cannot be set below 1 minute.

Phase durations are `number` entities (`Pre-wet Minutes` / `Fertigation Minutes` / `Flush Minutes`, defaults 5/20/5), adjustable at runtime from the web UI, Home Assistant, or MQTT; values survive reboots. A start while a sequence is running is ignored (`mode: single`).

Stopping (empty tank, knocked-over line, any reason) always goes through one abort script: pump off first, then both valves. Automatic interrupts are not implemented yet; planned options are a tank float switch on input 1 and pump current sensing (INA226 + shunt on the I2C bus — pump on but under ~2A sustained means it is not moving water; also yields battery voltage). Either would just call `abort_irrigation`.

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
