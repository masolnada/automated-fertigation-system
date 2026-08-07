# The low-flow watchdog is phase-aware: fertigation recovers, everything else stops dead

Low flow means an empty tank, and which tank depends on the phase. During
Fertigation the watchdog does not stop dead: it switches to clean water and runs
a full recovery Flush (as phase 3), then shuts down normally — so a cut-short
dose still leaves the system flushed. During Pre-wet, Flush, the recovery flush
itself, or manual operation it stops dead via `abort_irrigation`. Because the
recovery flush runs as phase 3, a second low-flow trip during it hits the
stop-dead rule automatically, giving one retry and no more.

## Consequences

The stop button and MQTT stop topic always stop dead, never triggering a recovery
flush — they are deliberate operator commands. Which escape was taken is
published (`irrigation/recovery_flush`) so the dashboard can distinguish a
recovery from a hard stop.
