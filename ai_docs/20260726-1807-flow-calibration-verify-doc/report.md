# Implementation report

## Completed

- Added the independent 387.0-factor verification result to the Calibration section in `docs/flow-sensor.md:91`, explicitly separating it from the four-run calibration table. It records the 11.07752 L reported / 11.1 L actual result, -0.20% residual, +/-0.45% scale resolution, and 10.85 L nominal-396 comparison.
- Updated `docs/flow-sensor.md:122` to retain generic future verification guidance while noting this unit's verified residual is inside the scale resolution.
- Left the four-run table, pooled 387.0 conclusion, and 396 worked example unchanged.

## Verification

- `grep -n "387\|396\|11.07752" docs/flow-sensor.md` — passed; verification figures and unchanged 396 worked example present.
- `git diff --check` — passed; no whitespace errors.
- Reviewed `docs/flow-sensor.md:80-131` — four-run table and pooled conclusion remain unchanged; Markdown table structure remains valid.
- No ESPHome command was run; no device contact or flashing was performed.

## Follow-ups

None.
