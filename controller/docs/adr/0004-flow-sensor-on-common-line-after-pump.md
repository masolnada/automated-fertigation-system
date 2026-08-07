# The flow sensor sits on the common line, after the pump

The single YF-B5 is plumbed after the pump on the line shared by both valve
paths, not on a per-tank branch. One sensor therefore meters both the clean-water
and fertigation phases, which is what makes volume-mode termination and the
phase-aware dry-run watchdog possible for every phase with a single part.
