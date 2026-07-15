# Design System: Minimalist E-Ink Dashboard

This document defines the constraints, styles, and implementation rules for the dashboard UI. Because this application is explicitly designed to target **e-ink (electronic paper) displays**, standard modern web design practices (such as shadows, gradients, and animations) are strictly prohibited.

The goal is absolute high-contrast legibility, zero layout shift, and minimal screen-refresh overhead.

---

## 1. Core Visual Principles

| Principle | Guideline | Why? |
| :--- | :--- | :--- |
| **Strict Monochrome** | Only pure black and pure white. A single mid-tone gray is allowed only for secondary borders or dividing lines. | E-ink screens have limited grayscale levels. Gradients look muddy and pixelated. |
| **Zero Animation** | Disable all transitions, transforms, scrolling effects, and animations. | Screen refresh rates are too slow. Moving elements cause severe flickering and screen ghosting. |
| **Sharp Geometry** | Use sharp, 90-degree corners for all containers. Avoid rounded corners. | Round, anti-aliased edges look fuzzy on low-DPI paper displays. |
| **Negative Space** | Maintain generous, consistent padding around the screen edges and wide gaps between content blocks. | Prevents visual clutter, making the physical screen look like structured paper. |

---

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
