# Document the 387.0 calibration verification run

## Context

`docs/flow-sensor.md` already records the four-run calibration that produced
387.0 pulses/L (Calibration section, table at docs/flow-sensor.md:80-85). The
factor is live on the device and flashed into `kc868-a8.yaml`.

A fifth run has now been done **with 387.0 in effect** to verify the
correction. It is not part of the calibration set — it is the independent
check — and must be presented as such, not appended to the calibration table.

### Verification data

- Reported: **11.07752 L** raw (displays as `11.1 L`; `accuracy_decimals: 1`
  at kc868-a8.yaml:594 rounds it)
- Actual: **11.1 L** weighed, same 0.3 kg bucket tare as the calibration runs
- Error: **-0.20%**
- Implied factor from this run alone: 386.2 pulses/L
- Scale resolution: +/-0.05 kg on 11.1 L = **+/-0.45%**

**Accuracy matters here.** The error is -0.20%, not zero. It is smaller than
the +/-0.45% scale resolution, so the honest statement is that the residual
error is *within measurement noise* / *indistinguishable from zero at this
scale resolution*. Do not write that the reading matched exactly.

Useful contrast: at the old 396 factor, that same 11.1 L would have reported
10.85 L.

## Scope

Edit `docs/flow-sensor.md` only. No YAML, no code, no other docs.

### 1. Record the verification run in the Calibration section

After the existing pooled-result paragraph (docs/flow-sensor.md:87-89), add
the verification result. It must be clearly separated from the four
calibration runs. State:

- run done with 387.0 already applied
- 11.07752 L reported (11.1 L displayed) vs 11.1 L actual, -0.20%
- residual is inside the +/-0.45% scale resolution, so the factor is confirmed
- the 10.85 L contrast figure for what 396 would have given

Match the existing prose and table style of the section.

### 2. Update the `### Verify` section (docs/flow-sensor.md:118-124)

It currently describes verifying in the abstract ("Run a second known volume
with the new factor set... within ~1-2%"). Keep it as generic instructions for
a future recalibration, but note that this unit has been verified and landed
inside the scale's resolution. Do not delete the generic guidance.

### 3. Leave alone

- The worked example (docs/flow-sensor.md:100-113) — invented illustrative
  numbers at 396, changing it breaks the arithmetic.
- The nominal-396 references at docs/flow-sensor.md:10 and :72.
- The four-run calibration table itself — the verification run is additional,
  it does not alter the pooled 387.0 result.

## Verification

1. `grep -n "387\|396\|11.07752" docs/flow-sensor.md` — confirm the
   verification figures are present and the worked example still reads 396.
2. Confirm the four-run table and the pooled 387.0 conclusion are unchanged.
3. Markdown tables and `> [!NOTE]` / `> [!IMPORTANT]` blocks must still render
   correctly.
4. **Do not run any `esphome` command.** This is a docs-only change; there is
   no ESPHome binary inside the sandbox and none is needed. Do not treat its
   absence as a blocker.
5. Do not flash or contact the device.
