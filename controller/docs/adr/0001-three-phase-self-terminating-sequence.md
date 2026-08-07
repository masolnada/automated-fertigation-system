# Irrigation is a three-phase, self-terminating sequence

The sequence runs Pre-wet → Fertigation → Flush and always shuts everything down
itself — there is no path where it ends with the pump running. Valve handovers
overlap 2 s and the pump stops before the last valve closes, so a running pump
always has an open source (the 3.8 bar pressure switch is only the backstop); the
Flush cannot be shortened below one minute because the residue-free guarantee is
not optional; a start while running is ignored (`mode: single`), and relays use
`restore_mode: ALWAYS_OFF` so a power loss comes up safe.
