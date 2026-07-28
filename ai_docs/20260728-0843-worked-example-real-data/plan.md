# Rewrite the flow-calibration worked example with this unit's real data

## Problem

`docs/flow-sensor.md:106-119` (the `### Worked example` section) uses invented
numbers that now contradict the rest of the document:

- it opens "Current factor 396" when the documented default is 387.0
- it invents T0=812.4, T1=823.1, 10.00 L collected
- it concludes 423.7 pulses/L, a figure that appears nowhere else and is far
  from this unit's real 387.0
- its worked direction is *over*-reporting (factor goes up), the opposite of
  what this sensor actually does

A reader is told the default is 387.0, then immediately shown an example
computing 423.7 from a 396 starting point. Confusing and self-contradictory.

## Scope

Edit the `### Worked example` section of `docs/flow-sensor.md` only. Do not
touch any other section, file, or the `ai_docs/` history.

## Change

Rewrite the worked example using **calibration run 1**, which is real, already
documented in the four-run table at docs/flow-sensor.md:80-85, and arrives at
the calibrated answer.

Run 1 facts:

- starting factor: **396** (the nominal default in force at the time)
- `T0 = 0` — Total Water was reset before the run
- `T1 = 10.87` L reported
- collected: **11.4 kg gross minus a 0.3 kg bucket tare = 11.1 L actual**
- `new_factor = 396 x 10.87 / 11.1 = 387.8 pulses/L`
- the device **under**-reported (10.87 < 11.1), so the factor goes **down**,
  which scales future readings **up**

Requirements for the rewritten section:

1. Keep the existing structure: a prose lead-in, a fenced code block showing
   the arithmetic, then a sentence explaining the direction of the correction.
2. Keep the arithmetic literally correct. 396 x 10.87 / 11.1 = 387.8. Show the
   intermediate step as the current example does.
3. **The 396 here is legitimate and must stay** — it is the factor that was in
   force during that run, not a stale default. Make that explicit so it does
   not read as a contradiction of the 387.0 default (e.g. note it is the
   nominal starting point the unit was calibrated away from).
4. Show the bucket-tare subtraction (11.4 - 0.3 = 11.1). It is a real trap and
   worth teaching.
5. Explain the direction correctly: under-reporting means the factor goes
   **down**. The current text says the opposite because its invented data
   over-reported. Do not copy that wording.
6. Note that run 1 alone gives 387.8, while the pooled four-run result is the
   387.0 actually adopted. This shows why the doc says to average runs and
   links the example to the table above it.

## Verification

1. Recompute by hand: 396 x 10.87 / 11.1 = 387.8. The code block must agree.
2. `grep -n "423.7\|812.4\|823.1" docs/flow-sensor.md` must return nothing —
   the invented figures are gone.
3. Confirm the numbers in the example match run 1 of the table at
   docs/flow-sensor.md:80-85 (reported 10.87, actual 11.1, implied 387.8).
4. Confirm no other section changed: `git diff docs/flow-sensor.md` should
   touch only the worked-example block.
5. Markdown must still render: fenced block closed, headings intact.
6. **Do not run any `esphome` command** and do not contact the device. This is
   docs-only; the absence of an ESPHome binary in the sandbox is expected and
   is not a blocker.
