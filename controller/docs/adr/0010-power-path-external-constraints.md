# The power path is bounded by operator-set constraints not visible in the code

Two limits live outside the firmware and must be set by hand. The MPPT must be
configured to **7 A max charge** in VictronConnect before connecting the battery,
because the 8 Ah LiFePO4 pack accepts at most 8 A while the panel can briefly
exceed its 100 W rating. And discharge headroom is thin: normal pumping totals
~4.5 A but near the pump's pressure cutoff it reaches ~8.2 A against a 10 A BMS,
so the drip network must be sized open enough that the pump never pressure-cycles;
if the BMS trips, the fix is a pack with a 20 A+ BMS, not a code change.
