# Total Water reset is guarded, irreversible, and persisted before success

Because Total Water is cumulative litres since the last reset and cannot be
recovered, a reset is refused unless the pump is off and flow is known to be
below threshold, and zero is written to preferences *before* success is reported.
The native button and the MQTT request topic invoke the same guarded automation,
which publishes one non-retained result on `flow/reset_total/result`
(`success`, `already_zero`, one of the `rejected_*` reasons, or
`error_persistence` — the last meaning RAM is zero but may not survive reboot).
