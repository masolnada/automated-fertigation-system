# A volume phase has no time cap; only the Min Flow watchdog bounds it

ESPHome's `delay` cannot express "until N litres", so a volume phase uses
`wait_until` on a metered-delta lambda and therefore has no upper time bound of
its own. This is deliberate: the Min Flow watchdog is the single mechanism that
bounds a stalled phase (worst case `target / min_flow`), rather than adding a
separate per-phase timeout that could disagree with it.
