# Confirmations are native top-layer dialogs

A Confirmation guards a consequential act (starting the pump, starting
irrigation, resetting Total Water, renaming a zone), so it must reliably sit on
top of the page it interrupts. The previous hand-rolled dialog was a
`position: fixed` div painted `bg-paper` — opaque white across the whole
viewport, which read as a full-page takeover rather than an overlay, and whose
`z-10` would have been trapped by the first ancestor to grow a `transform`. We
render Confirmations with the native `<dialog>` element opened via `showModal()`,
which puts them in the browser's top layer, makes the rest of the page inert,
traps and restores focus, and provides `::backdrop` for the scrim.

## Consequences

- The focus trap, background inertness and focus-restore-on-close are the
  platform's, not ours. The dialog no longer takes an `opener` element to focus
  on close, and callers no longer track one.
- Escape-to-cancel is browser-native, reaching us as the `cancel` event, which we
  `preventDefault()` while a command is in flight. happy-dom does not fire
  `cancel` from a keypress, so that path is not covered by tests; the equivalent
  guard on the Cancel button still is.
- The scrim lives in `::backdrop`, which the `* { }` reset in `eink.css` and the
  palette audit in `variants.test.ts` cannot see. It is documented in DESIGN.md
  as a structural layer rather than a palette entry.
- Background scrolling is blocked by us, not the platform
  ([whatwg/html#7732](https://github.com/whatwg/html/issues/7732) is still open).
  The lock is pure CSS — `html:has(dialog[open]) { overflow: hidden }` — so it
  needs no effect, no cleanup, and cannot strand a locked page if a Confirmation
  unmounts while open. It applies to any open dialog, which is correct while
  Confirmations are the only ones.
- `html` carries `scrollbar-gutter: stable` permanently so that removing the
  scrollbar shifts nothing, honouring the zero-layout-shift rule in DESIGN.md
  §3. The gutter and the lock must sit on the same element, or the reserved
  gutter paints as an undimmed strip beside the scrim. Where the platform uses
  overlay scrollbars (iOS, macOS by default) the property is inert and there is
  no shift to prevent.
