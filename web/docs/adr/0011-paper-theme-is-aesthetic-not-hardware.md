# The paper theme is an aesthetic choice, not an e-ink hardware constraint

ADR-0002 justified the design system by a target e-ink panel, which made its
rules physical facts: no colour because e-ink has few grey levels, no motion
because of ghosting. There is no e-ink panel — the dashboard runs on ordinary
screens — so the justification was wrong even though the look is still wanted.
The constraints are kept as a deliberate minimal aesthetic, and the two rules
that only ever made sense as hardware limits are relaxed.

Colour is no longer capped at two exceptions but is still closed and semantic:
every colour means exactly one thing, must be legible without colour, and is
listed in DESIGN.md. `water` (`#A8D8EA`) joins `action` and `danger`, marking the
path water takes; movement, not colour, signals that flow is live. Motion becomes opt-in rather than forbidden: the global
reset still strips all animation and transition so nothing arrives by accident,
and an element opts back in with `data-motion` only where the movement itself
carries information — currently just the schematic's flow dashes.

## Consequences

- Adding a colour is a documentation change first: no colour without a meaning.
- `data-motion` is the single audit point for anything that moves.
- If an e-ink target ever appears, this is the ADR to revisit: `water` renders as
  low-contrast grey there, and the flow dashes would ghost.
