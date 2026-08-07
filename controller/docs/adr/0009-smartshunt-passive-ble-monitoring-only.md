# SmartShunt is read passively over encrypted BLE, for monitoring only

The battery is monitored by listening passively to the Victron SmartShunt's
AES-encrypted BLE "instant readout" advertisements — no pairing, no wiring,
read-only, and VictronConnect keeps working in parallel. Decoding uses the
`esphome-victron_ble` external component pinned to an immutable release tag so
the trusted code cannot change silently. Deliberate scope limit: nothing acts on
these readings yet — there is no firmware low-voltage or low-temperature
protection, and load disconnect is left to the MPPT's own output.
