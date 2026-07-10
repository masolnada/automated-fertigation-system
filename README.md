# automated-watering-system

ESPHome configuration for a KinCony KC868-A8 used as an irrigation controller.

Hardware: ESP32 (WROOM-32), 8 relay outputs and 8 digital inputs via PCF8574 I2C expanders, DS18B20 on GPIO14. Network is WiFi with a fallback AP (`kc868-a8`); MQTT broker and OTA are configured. The board also has LAN8720 Ethernet, unused — ESPHome does not allow `ethernet:` and `wifi:` in the same config.

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
