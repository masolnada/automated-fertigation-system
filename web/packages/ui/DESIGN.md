# Design System: Minimalist Paper Dashboard

This document defines the constraints, styles, and implementation rules for the dashboard UI. The look is deliberately paper-like and minimal: high-contrast, flat, and structural. It is an aesthetic choice, not a hardware constraint — the dashboard renders on ordinary screens, so shadows, gradients and decorative flourishes are still avoided, but purely for visual discipline.

The goal is absolute high-contrast legibility, zero layout shift, and a calm, uncluttered surface.

The theme ships in two substrates, **Light** and **Dark**. Dark is a *mode* of this design system, not a second theme: every rule below applies unchanged to both, and only the substrate inverts. `ink` and `paper` are therefore roles — foreground and substrate — not literal black and white. A token takes a per-mode value **only where the substrate forces it** — which means where it becomes illegible *or* where it stops carrying the weight it is supposed to have; see *Colour semantics*.

---

## 1. Core Visual Principles

| Principle | Guideline | Why? |
| :--- | :--- | :--- |
| **Restrained Palette** | Black, white and a single mid-tone gray carry the interface. Colour is reserved for meaning — see *Colour semantics* below — and is never decorative. No gradients. | Colour that always means something stays readable at a glance. |
| **Purposeful Motion** | No transitions on ordinary state changes, and nothing that moves for decoration. Animation is allowed only where the movement itself carries information. | Motion is a strong signal; spending it on decoration makes it useless where it matters. |
| **Sharp Geometry** | Use sharp, 90-degree corners for all containers. Avoid rounded corners. | Keeps the surface structural and paper-like. |
| **Negative Space** | Maintain generous, consistent padding around the screen edges and wide gaps between content blocks. | Prevents visual clutter, making the screen look like structured paper. |

---

### Action semantics

`action` is reserved for the one primary, affirmative action on a surface: for example, **Start irrigation**. Pair it with a direct verb label, `ink` text and an `ink` border. Do not use it for decorative elements, secondary controls, or more than one action in the same control group. Do not use it for status — status green is `connected`, a separate entry with its own rules below.

A Confirmation is a surface in its own right, so its confirm button is that one action and carries `action` — unless the act is destructive, in which case it carries `danger` instead and the dialog has no `action` at all. Cancel is always the plain control, so the pair never shows two primaries.

### Connection semantics

`connected` marks a live connection in the header status strip — controller, MQTT and API — and nothing else. It is the only status in the interface permitted to carry green.

It shares Action Green's value but is a separate entry, because it does not behave like `action`: it keeps **one value on both substrates**. `action` is a wide bordered surface, so its dark value is darkened to stop it glaring; `connected` is a bare 12px mark whose fill is the entire signal, and darkening it the same way drops it to 1.44:1 against the dark page — an unlit dot. Framed by the mark's `ink` border, the single pale value reads on both substrates.

Colour must not carry the state alone, and here it especially cannot: on the dark page `connected` and `danger` are both light fills only 1.96:1 apart, so they are near-identical without colour perception. The two states are therefore separated by shape as well — **connected is solid, disconnected is hollow with a `danger` border** — and each mark is labelled.

### Quantitative heatmap exception

A watering-volume heatmap may use the following solid blue shades as its only quantitative colour scale: `#E8F1F8`, `#CBE0EF`, `#9FC7E2`, `#5B95C4`, and `#1B4F7E`. This exception applies only to fixed daily-litre bands, must provide equivalent accessible text for every cell, and must never use gradients. A visible legend may be omitted when selecting a cell exposes its exact litres in the adjacent Daily Inspector. Zero litres remain the substrate. A day containing any non-completed watering event retains its volume fill and uses a Danger Red border.

The scale reads volume as *ink density*, and density runs the other way on dark paper — so Dark mirrors the ramp rather than reusing it: `#12303F`, `#194A63`, `#22637F`, `#7FB6D9`, `#CDE6F6`, climbing from the substrate toward light blue. Same five fixed litre bands, same rules. Because the ramp mirrors along with the substrate, the loudest bands are always the ones furthest from the page and take `paper` for their text — the top band in Light, the top two in Dark.

### Zone identity colour

A **Zone colour** is a disposable, browser-local aid used only to tell one live Zone from another. It is a controlled exception to the closed semantic palette: it carries no meaning beyond distinctness, never stands in for `danger`, `warning`, `connected`, `action` or `water`, and lives only in `localStorage` — nothing about it reaches the server (web ADR-0019).

Rules:

- **An aid, never state.** A Zone keeps its colour whether its output is open or shut. `OPEN`/`SHUT`, the `water` route, `danger` rows and archive labels carry state; Zone colour never does. On a non-completed watering event, `danger` owns the row and the Zone marker sits alongside it unchanged.
- **Picked per Zone, freely.** Each Zone is coloured from its row in the Zones card, from a palette shown with operator-facing names. Colours may repeat across Zones and be changed at any time; nothing is reserved and creation never involves colour.
- **Editable and disposable.** The choice is kept per browser only, so it differs between devices and is not guaranteed distinct. “No colour” returns a Zone to gray.
- **Archived Zones have no colour.** Archiving drops the colour outright; an archived Zone renders gray, and restoring it starts uncoloured.
- **Equal visual weight.** Borders, stripes and bands use the stronger stroke; the marker square uses the quieter fill. No Zone should read louder than another.
- **Spread the hue wheel for distinctness.** The palette is Terracotta, Ochre, Olive, Teal, Petrol, Indigo, Purple and Magenta, spaced around the wheel so picks read apart at a glance. They skirt the exact state hues (`danger` red, `warning` amber, `connected`/`action` green, `water` cyan); the earth tones sit off the `warning` amber and the teal off the `water` cyan by saturation and lightness. Because a Zone tint is always a fill behind the Zone name and never the sole signal, this proximity is acceptable.
- **A supporting cue, never the identifier alone.** Each entry is distinguishable from the others in both substrates for typical colour vision, but the palette is not guaranteed colour-blind-safe. The Zone name therefore remains present wherever its colour is used.
- **Only a coloured live Zone shows a marker.** An uncoloured Zone, an unassigned output channel, and a run recorded against no Zone get no colour and no marker.
- **The marker square keeps an `ink` border** on both substrates, so a faint hue stays visible and holds its shape in greyscale.
- **Each key owns Light and Dark fill and stroke values**, so the same pick renders legibly on either substrate.

| Key | Light fill | Light stroke | Dark fill | Dark stroke |
| :--- | :--- | :--- | :--- | :--- |
| `terracotta` | `hsl(18 45% 74%)` | `hsl(18 62% 38%)` | `hsl(18 35% 30%)` | `hsl(18 60% 66%)` |
| `ochre` | `hsl(32 40% 69%)` | `hsl(32 55% 32%)` | `hsl(32 32% 27%)` | `hsl(32 46% 60%)` |
| `olive` | `hsl(70 34% 66%)` | `hsl(70 48% 28%)` | `hsl(70 30% 25%)` | `hsl(70 40% 57%)` |
| `teal` | `hsl(175 34% 66%)` | `hsl(175 55% 26%)` | `hsl(175 34% 24%)` | `hsl(175 44% 56%)` |
| `petrol` | `hsl(205 24% 72%)` | `hsl(205 58% 32%)` | `hsl(205 30% 28%)` | `hsl(205 50% 66%)` |
| `indigo` | `hsl(252 50% 80%)` | `hsl(252 55% 43%)` | `hsl(252 32% 30%)` | `hsl(252 58% 72%)` |
| `purple` | `hsl(288 46% 80%)` | `hsl(288 52% 40%)` | `hsl(288 30% 29%)` | `hsl(288 55% 70%)` |
| `magenta` | `hsl(322 50% 79%)` | `hsl(322 58% 39%)` | `hsl(322 32% 28%)` | `hsl(322 60% 69%)` |

Not used in the year heatmap or the month calendar, which stay volume-only. Zone colour appears wherever a Zone is named — the schematic's assigned outputs, schedules, the Zones card, the assignment editor, the irrigation picker, and the Daily Inspector.

### Danger semantics

`#B00020` may be used only for errors, offline states, destructive controls/actions, danger-dialog messages, and danger event rows. Pair it with a clear text label and an appropriate border or fill; colour alone must never convey the state. White text is permitted on a filled danger control for contrast. Do not use red decoratively.

### Warning semantics

`#8A5A00` marks a blocked precondition: an act the system refuses because something the operator can change is not yet true. Nothing is broken and nothing is lost — the operator clears it by acting on the system. Use it for the pump with no open path and for a Total Water reset that is not yet eligible.

The line against Danger Red is one test: **if the operator can clear it right now by acting on the system, it is a warning; if something has failed, gone offline, or will be destroyed, it is danger.** Amber never marks harm and red never marks a mere precondition. Pair warning with a clear text label and a border or fill; colour alone must never convey the state. Do not use amber decoratively, and do not use it as a softer red.

### Colour semantics

Every colour in the palette must mean exactly one thing, and that meaning must also be available without colour (text, border, or fill). The palette is closed — adding a colour means adding a meaning, and belongs in this document first.

| Token | Light | Dark | Meaning |
| :--- | :--- | :--- | :--- |
| `ink` | `#000` | `#E8E8E8` | Foreground |
| `paper` | `#fff` | `#121212` | Substrate |
| `gray` | `#808080` | `#808080` | Dividers and disabled state |
| `action` | `#B7E4C7` | `#153821` | The one primary, affirmative action on a surface |
| `connected` | `#B7E4C7` | `#B7E4C7` | A live connection in the header status strip |
| `warning` | `#8A5A00` | `#E0A33A` | A blocked precondition the operator can clear |
| `danger` | `#B00020` | `#FF6B7A` | Errors, offline and destructive actions |
| `water` | `#A8D8EA` | `#A8D8EA` | The path water takes through the system |

A meaning has one row, whichever substrate is showing. A token takes a second value only when the first fails on the other substrate. Dark is softened rather than a true inversion — pure white on pure black haloes at night, which is when the mode is used.

There are two distinct ways to fail, and both count:

* **Illegible** — too close to the substrate to read. `danger` (2.8:1 on dark) and `warning` (3.5:1) are lightened for this reason.
* **Wrong weight** — legible, but no longer sitting at the right loudness. `action` is a *quiet* fill: in light it lifts off the page by only 1.41:1 and lets the black border carry the structure. Reused unchanged on a dark substrate it inverts into the brightest thing on the screen (13.32:1) and its `ink` border vanishes into its own fill (1.15:1) — legible, and wrong. Dark takes the same hue and saturation at a lightness that restores the original relationship: 1.44:1 off the page, 10.58:1 for border and label.

A fill that inverts with the substrate is always labelled with `ink` or `paper` — `ink` when the fill sits near the page, `paper` when it sits opposite. Never hard-code a foreground to defeat a fill that failed to invert; fix the fill.

`water` and `connected` are the exceptions that keep one value. `water` is a stroke on the schematic, never a filled surface carrying a label, so it has no foreground to pair with and needs only to stay visible against either page (1.54:1 light, 12.2:1 dark). `connected` is a bare mark whose fill is the whole signal, so it cannot be re-weighted per substrate without disappearing; see *Connection semantics*.

Two entries may share a value while remaining separate entries, as `action` and `connected` do. What makes them one entry or two is the meaning and the behaviour, not the hex: they diverge in dark, and a future change to one must not silently move the other.

`water` marks the selected route on the schematic. The route is drawn in it whether or not the pump is running; movement — not colour — is what signals live flow. Do not use it for water *quantities* (the heatmap owns those), for status text, or as a surface colour.

## 2. Typography Rules

Do not use gray text to establish visual hierarchy. Use size, weight, and layout instead.

* **Primary Font:** System sans-serif for crisp, highly readable UI elements.
* **Secondary/Numerical Font:** High-contrast slab serif or bold monospace for heavy data metrics (e.g., clocks, temperatures).
* **Sizing & Weights:**
    * **Hero Metrics (Time/Main Value):** Extra large, ultra-bold, pure black.
    * **Card Headers:** Small, bold, uppercase, with wide letter-spacing.
    * **Body Text:** Large enough to ensure high physical legibility on small screens.
* **Line Height:** Keep spacing between lines of text generous to prevent physical ink-bleeding on-screen.

---

## 3. Structural Layout Rules

* **Layout Grid:** Use a structured, rigid grid. Do not overlap elements or allow elements to shift dynamically on load.
* **High-Contrast Containers:** Use thick, solid black borders to enclose widgets instead of background colors or drop shadows.
* **Modal Scrim:** A modal dims the page behind it with a translucent black layer. This is a structural device, not a palette entry — it adds no new meaning and is the only permitted translucency. Being structural rather than a token, it is **the one element that does not invert**: dimming is dark on either substrate, so the scrim stays black in Dark rather than tracking `ink` and washing the page pale. The page must stay visible through it: an opaque backdrop reads as a full-page takeover rather than an overlay. Opening a modal must shift no layout, so the scrollbar gutter is reserved permanently rather than appearing and disappearing with the scroll lock.
* **Dashed Dividers:** Use thick, dashed lines rather than thin solid lines for internal section dividers. Dashed patterns render much cleaner on e-paper.

---

## 4. UI Patterns & Elements

### Data Indicators
* **Do:** Use large, bold numbers alongside small, clear unit labels (e.g., **22** `°C`).
* **Don't:** Use circular radial progress bars. Use horizontal solid block progress bars instead (e.g., `[████░░░░░░]`).

### Icons
* Only use vector-based, line-art stroke icons (ensure lines are thick and well-defined).
* No filled-solid dark icons unless they represent an active "toggle" state.
* Never use color icons.
