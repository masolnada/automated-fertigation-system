# A cycle is sized by volume or time, with one split percentage

The cycle total is a single figure in either litres or minutes, chosen by
`Cycle Mode`; both totals (`Cycle Liters`, `Cycle Minutes`) are retained
independently so switching modes keeps each value. A single `Pre-wet Percent`
(5% steps) splits that total between Pre-wet and Fertigation, with Fertigation as
the remainder — there is deliberately no fertigation-percent entity, so the split
cannot become inconsistent.

## Considered options

Per-phase minute entities (the previous model) were dropped: litres and minutes
are not comparable, so one total plus a percentage keeps exactly one termination
condition per phase and makes the phase bar's proportions correct by
construction. The Flush stays a separate always-time-based entity outside the
split — it is a fixed safety phase, not a proportional share of the dose.
