# The flow K-factor is runtime-adjustable

The YF-B5 pulses-per-litre factor is a `number` entity (`restore_value: true`),
not a compile-time constant, so the unit can be calibrated against weighed
volumes and corrected from the UI without reflashing. This unit measured 387
pulses/L against the 396 nominal; the firmware's `initial_value` and lambda
fallbacks use the measured 387 so a fresh flash or preferences wipe starts
near-correct rather than 2.3% off.
