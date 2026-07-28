# Record the measured YF-B5 K-factor (387.0 pulses/L)

## Context

The YF-B5 flow sensor was calibrated against four weighed volumes. The unit
under-reads the nominal 396 pulses/L default by ~2.3%.

| run | reported L | actual L | err %  | implied factor |
|-----|------------|----------|--------|----------------|
| 1   | 10.87      | 11.1     | -2.07  | 387.8          |
| 2   | 11.4       | 11.7     | -2.56  | 385.8          |
| 3   | 11.5       | 11.8     | -2.54  | 385.9          |
| 4   | 10.7       | 10.9     | -1.83  | 388.7          |

Pooled: 44.47 L reported vs 45.50 L actual -> **387.0 pulses/L**
(mean 387.1, stdev 1.4, range 385.8-388.7). All runs used factor 396 and
started from Total Water = 0. Volumes are scale readings minus a 0.3 kg bucket
tare; water is ~1.000 kg/L.

**The running device has already been set to 387.0 at runtime** via the web API
number entity. It persists through `restore_value: true`. This task only
records the calibrated value in the repo so a fresh flash or a preferences wipe
starts near-correct.

## Scope

Edit `kc868-a8.yaml` and `docs/flow-sensor.md` only. No other files. Do not
flash, do not touch the device, do not modify secrets.

### 1. `kc868-a8.yaml:203` — the calibration value

```yaml
    initial_value: 396
```
becomes
```yaml
    initial_value: 387.0
```

This is the substantive change. Note `restore_value: true` on line 205 means
this only applies on first boot or after a preferences wipe.

### 2. `kc868-a8.yaml:574` and `kc868-a8.yaml:585` — lambda fallbacks

```cpp
return x / (k > 0 ? k : 396.0);
id(water_total_l) += delta / (k > 0 ? k : 396.0);
```

Change both `396.0` fallbacks to `387.0`. These fire only if the number entity
is unset or invalid; using the measured factor means a degraded boot does not
silently revert to a 2.3% error.

### 3. Comments in `kc868-a8.yaml`

- Line 194: keep the statement that the *nominal* K-factor is 396, but note
  this unit measured 387.0. Keep the pointer to `docs/flow-sensor.md`.
- Line 556: `# YF-B5 flow sensor on GPIO14 (sensor header S1). 396 pulses per liter.`
  -> reflect 387.0 measured / 396 nominal.
- Line 570: `# pulse_counter reports pulses/min; 396 pulses = 1 L.`
  -> same treatment.

Preserve the existing comment style and line wrapping.

### 4. `docs/flow-sensor.md`

Update so the measured value is the documented one:

- Line 10: `**396 pulses = 1 litre**` — this describes the sensor's nominal
  spec in the wiring/theory section. Keep 396 as nominal, but make clear it is
  the datasheet figure.
- Line 47: `a / 396.0 lambda converts to L/min` -> 387.0, matching change 2.
- Line 70-73: the Calibration intro calling 396 "the default" and
  "`default 396`" -> 387.0 is now the default; 396 is the nominal the unit was
  calibrated away from.
- **Lines 88-93 (Worked example): leave at 396.** This is illustrative
  arithmetic with invented numbers (T0=812.4, T1=823.1, 10.00 L collected).
  Changing it would break the worked sum. Do not touch.

Add the four-run result table and the 387.0 conclusion to the Calibration
section so the provenance is recorded.

## Verification

1. `../my-esphome/.venv/bin/esphome config kc868-a8.yaml` must succeed. This
   validates YAML and lambda syntax without touching the device. It needs
   `secrets.yaml`, which is present and gitignored.
2. `grep -n 396 kc868-a8.yaml docs/flow-sensor.md` — the only remaining hits
   should be the nominal-K-factor comments and the worked example at
   docs/flow-sensor.md:88-93.
3. Confirm `restore_value: true` at kc868-a8.yaml:205 is unchanged.
4. Do not run `esphome run` or any flash/upload command.

## Out of scope

- Flashing the device. The runtime value is already correct; a flash is not
  needed and `restore_value` would override `initial_value` anyway.
- Resetting Total Water. That is the user's call, done from the UI.
- Any dashboard, observability, or secrets change.
