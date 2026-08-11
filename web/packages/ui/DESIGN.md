# Design System: Minimalist Paper Dashboard

This document defines the constraints, styles, and implementation rules for the dashboard UI. The look is deliberately paper-like and minimal: high-contrast, flat, and structural. It is an aesthetic choice, not a hardware constraint — the dashboard renders on ordinary screens, so shadows, gradients and decorative flourishes are still avoided, but purely for visual discipline.

The goal is absolute high-contrast legibility, zero layout shift, and a calm, uncluttered surface.

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

`#B7E4C7` is reserved for the one primary, affirmative action on a surface: for example, **Start irrigation**. Pair it with a direct verb label, black text, and a black border. Do not use it for status, decorative elements, secondary controls, or more than one action in the same control group.

### Quantitative heatmap exception

A watering-volume heatmap may use the following solid shades derived from Action Green as its only quantitative colour scale: `#EAF6EE`, `#D2EEDA`, `#B7E4C7`, `#78C494`, and `#2F7D4F`. This exception applies only to fixed daily-litre bands, must provide equivalent accessible text for every cell, and must never use gradients. A visible legend may be omitted when selecting a cell exposes its exact litres in the adjacent Daily Inspector. Zero litres remain white. A day containing any non-completed watering event retains its volume fill and uses a Danger Red border.

### Danger semantics

`#B00020` may be used only for warnings and errors, offline states, destructive controls/actions, danger-dialog messages, and danger event rows. Pair it with a clear text label and an appropriate border or fill; colour alone must never convey the state. White text is permitted on a filled danger control for contrast. Do not use red decoratively.

### Colour semantics

Every colour in the palette must mean exactly one thing, and that meaning must also be available without colour (text, border, or fill). The palette is closed — adding a colour means adding a meaning, and belongs in this document first.

| Token | Value | Meaning |
| :--- | :--- | :--- |
| `action` | `#B7E4C7` | The one primary, affirmative action on a surface |
| `danger` | `#B00020` | Warnings, errors, offline and destructive actions |
| `water` | `#A8D8EA` | The path water takes through the system |

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
