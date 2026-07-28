# Blocker: ESPHome validation unavailable

## What is blocked

The required validation command cannot run because the specified ESPHome executable is absent:

```text
../my-esphome/.venv/bin/esphome config kc868-a8.yaml
/bin/bash: line 1: ../my-esphome/.venv/bin/esphome: No such file or directory
```

`find .. -path '*/bin/esphome' -type f` found no ESPHome executable under the mounted parent workspace.

## Work completed

The planned edits are implemented in the two scoped files:

- `kc868-a8.yaml`: changed `pulses_per_liter` initial value and both invalid-value lambda fallbacks to `387.0`; updated the three calibration comments; kept the calibration entity's `restore_value: true` unchanged at `kc868-a8.yaml:205`.
- `docs/flow-sensor.md`: documented the datasheet-nominal 396 figure, the 387.0 firmware conversion/default, and the four-run measured calibration table plus pooled conclusion. The worked example remains unchanged at 396.

`grep -n 396 kc868-a8.yaml docs/flow-sensor.md` was run to inspect the remaining nominal/provenance and worked-example references.

## Needed to proceed

Make the expected `../my-esphome/.venv/bin/esphome` environment available in this sandbox (or provide the approved ESPHome executable/path), then run the required `esphome config kc868-a8.yaml` validation.
