# Dark is a mode of the paper theme, not a second theme

The dashboard is used outdoors after dark, where a white page is hostile, so it
now ships a dark substrate. ADR-0011 said the paper theme was the single shipped
theme; that stands as a claim about the *design language* but no longer about the
substrate, and this ADR amends it. Dark changes nothing about the language —
sharp corners, heavy borders, flat surfaces, purposeful motion and a closed
semantic palette all apply unchanged. Only the substrate inverts, which makes
`ink` and `paper` role names (foreground, substrate) rather than literal black
and white.

A token takes a per-mode value **only where the substrate forces it**, and there
are two ways it can: the token becomes illegible, or it stays legible but stops
carrying the weight it is meant to. `danger` (2.8:1 on dark) and `warning`
(3.5:1) fail the first way. `action` fails the second — it is a deliberately
quiet fill that in light lifts off the page by 1.41:1 and lets its black border
do the structural work, but reused unchanged on a dark substrate it becomes the
brightest thing on screen at 13.32:1 while its border disappears into its own
fill at 1.15:1. Its dark value keeps the hue and saturation and moves only
lightness, restoring the original relationship (1.44:1 off the page, 10.58:1 for
border and label). `water` and `gray` keep one value. The dark substrate is
softened (`#121212`/`#E8E8E8`, 15.8:1) rather than a true inversion, because pure
white on pure black haloes at night — the condition the mode exists for.

The mode is chosen by a two-state toggle persisted per browser, with no System
position. `prefers-color-scheme` seeds the very first paint and is never
consulted again: the operator's choice is not overridden at sunset by a device
that disagrees. An inline script in `index.html` applies the mode before first
paint and is the sole author of the initial value — the app reads the attribute
back rather than deciding a second time, so the two cannot disagree. The
preference is per-device and per-browser, so unlike a zone name (ADR-0010) it is
deliberately client-owned and never reaches the server.

## Consequences

- Adding a colour still means adding a meaning, but now also means answering
  whether it survives both substrates — at the right loudness, not merely
  legibly.
- Every fill inverts with the substrate, so a foreground is always `ink` or
  `paper`: `ink` where the fill sits near the page, `paper` where it sits
  opposite. A fill that has to be rescued by a fixed foreground is the wrong
  fill — that was the first attempt at the Start irrigation button, and it left
  the control glaring with an invisible border.
- The heatmap needs a mirrored ramp, since it reads volume as ink density and
  density runs the other way on dark paper. Mirroring also means the bands
  needing `paper` text differ per substrate (the top one in light, the top two
  in dark).
- The modal scrim is the one element that does not invert. It is structural
  rather than a palette entry, and dimming is dark on either substrate.
- Two substrates means every future surface has two ways to be wrong, and no
  automated guard: nothing fails if a component hard-codes a colour or is only
  ever checked in light. This was accepted deliberately.
