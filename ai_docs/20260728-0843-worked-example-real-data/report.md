# Implementation report

## Completed

- Rewrote only the worked-example block in `docs/flow-sensor.md:106-122` with calibration run 1's real data: factor 396, reset Total Water, 10.87 L reported, and 11.4 kg gross minus 0.3 kg tare = 11.1 L actual.
- The arithmetic now shows `396 × 10.87 / 11.1 = 387.8 pulses/L`, correctly explains that under-reporting lowers the factor and scales future readings up, and relates the single-run result to the pooled 387.0 adopted factor.

## Verification

- `node -e 'console.log((396 * 10.87 / 11.1).toFixed(1))'` → `387.8`.
- `grep -nE '423\.7|812\.4|823\.1' docs/flow-sensor.md` returned no matches.
- Reviewed `git diff --check && git diff -- docs/flow-sensor.md`: clean whitespace; only the worked-example block changed.
- Reviewed the worked-example range to confirm its fenced code block closes before `### Verify`.
- No ESPHome command was run.

## Follow-ups

None.
