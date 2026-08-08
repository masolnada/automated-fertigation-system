# The on-device watering-event log lives in ESP32 NVS, not the AT24C32 EEPROM

The durable ring buffer of watering events (so a controller that spends weeks in
the field without WiFi loses no history) is stored as an ESPHome `restore_value`
global in the ESP32's NVS partition, because it is ESPHome-native and needs no
hand-rolled persistence code. The DS3231 breakout also carries an AT24C32 (4 KB
I2C EEPROM at 0x57) that is arguably the better home for an append-only ring —
byte-addressable per-slot writes, isolated from the shared NVS partition — but
using it means raw I2C reads/writes and manual slot/head management in lambdas,
which we judged not worth the complexity for now.

## Considered options

- **NVS `restore_value` global (chosen):** simplest, ESPHome-native. Cost: NVS
  rewrites the whole blob on every event, and the log shares the small NVS
  partition with WiFi calibration and other globals.
- **AT24C32 EEPROM (deferred):** the natural fit for a per-event ring — cheap
  single-slot writes, dedicated storage — but no ESPHome core component exists, so
  it is entirely custom I2C firmware.

## Consequences

If the whole-blob rewrite causes wear or partition pressure, or the log needs to
grow well past N=192 events, migrating the ring buffer to the AT24C32 is the
identified future improvement. The move is firmware-only and does not change the
MQTT wire format the server consumes.
