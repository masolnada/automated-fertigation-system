# Guidance — round 2

The port is accepted in substance: typecheck is clean, 13 unit tests pass, the
build and container work, `packages/mqtt` is genuinely framework-free, and no
imperative DOM access remains. Good work.

Two gaps from `plan.md` must now be closed. **Do not change any safety
behaviour, topic string, or user-visible text while doing this.** Parity is
already achieved; this round is about test coverage and the theme boundary only.

Re-verify at the end that `bun run typecheck`, `bun test`, and `bun run build`
all still pass, and that the guard chain in `packages/mqtt/src/guards.ts` is
byte-for-byte unchanged in behaviour.

---

## Gap 1 — the integration test suite is missing (plan step 11)

`aedes` is declared in `web/package.json` but never imported.
`@testing-library/react` was never installed. Only
`packages/mqtt/src/mqtt.test.ts` exists, so plan contract items **4, 5, 6 and
12** have zero coverage — precisely the behaviours the plan named as the top
risk.

### 1a. Install what is missing

```
bun add -d @testing-library/react @testing-library/dom @happy-dom/global-registrator
```

`aedes` and `ws` are already present. Verified working combination (I prototyped
it): `bun test --preload <registrator preload>` + `@testing-library/react`
renders components fine. Add a small preload file rather than relying on
`--preload @happy-dom/global-registrator` on the command line, and wire it via
`bunfig.toml` `[test] preload` so a bare `bun test` picks it up. A bare
`bun test` must run the whole suite with no extra flags.

### 1b. Broker-backed integration tests

Start an `aedes` broker over WebSockets in-process on an **ephemeral port**
(port 0, then read the assigned port) so tests never collide. Drive the real
`mqtt` client against it. Close the broker in an `afterAll` so the test process
exits cleanly.

Cover:

- **Retained-state replay.** Publish retained values for pump, flow_rate,
  total_water, the three duration numbers, battery entities and
  `<prefix>/status = online` *before* the client connects; assert the UI shows
  the formatted values (correct decimals) after connect.
- **Reset happy path.** With an eligible snapshot, confirm the dialog and assert
  a **non-retained** publish of `<prefix>/flow/reset_total/request` = `ON`, then
  publish `success` on the result topic and assert the dialog closes and the log
  gains `total water reset`.
- **Every rejection payload** from contract item 3: `already_zero`,
  `rejected_pump_running`, `rejected_flow_active`, `rejected_flow_unknown`,
  `error_persistence`, plus one unexpected payload hitting the
  `Unexpected reset response: …` branch. Assert the exact message and severity.
- **Result logged with no dialog open** — native-web resets use the same topic,
  so the event must still appear.
- **Invalidate on reconnect and on device-offline.** After `status = offline`,
  and again after a broker close/reconnect, assert the reset guard returns to
  `"Device or broker offline"` / `"Waiting for state"` and values render as `–`.

### 1c. Component tests (happy-dom + Testing Library)

- **Contract 4 — pending dialog is non-cancellable.** While a reset is pending,
  Cancel, Escape and backdrop click must all be no-ops. Only a resolved result
  or the 10s timeout resolves it. Use fake timers for the timeout and assert the
  exact message `No response from device. Check its connection and current total
  before retrying.`
- **Contract 5 — eligibility stays live.** With the dialog open, push a state
  change that makes the reset unsafe and then safe again; assert the confirm
  button and reason text follow.
- **Contract 6 — valve exclusivity.** Selecting a valve publishes `ON` to it;
  selecting Closed publishes `OFF` to **both**; the pending mark clears after
  5s; assert both pending status strings (pump on vs pump off) exactly.
- **Contract 12 — dialog a11y.** `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby`, `aria-describedby`; Tab/Shift-Tab cycles **enabled** buttons
  only; Escape closes an open menu before the dialog; focus returns to the
  opener on close.
- **Contract 9 — a focused number input is not overwritten** by an incoming
  retained update.

If any of these reveals a real defect in the implementation, **fix the
implementation**, not the test. If a contract item looks genuinely wrong, stop
and write `blockers.md`.

---

## Gap 2 — Tailwind is unused and the theme boundary is nominal (plan step 7)

`apps/dashboard/src/styles.css` is a 467-line near-verbatim copy of the old
`dashboard/site/style.css` (465 lines). Components use semantic classes
(`className="card-relays"`), and `packages/ui/src/theme/variants.ts` merely maps
names onto those same strings. Tailwind is imported but contributes nothing, and
the `@theme` tokens are defined but unused.

The Q7 goal was that **trying a different design = writing a new variant map +
token file, with no behavioural rewrite**. That is not currently possible.

### What to do

Move the styling into the theme layer so the primitives carry no hard-coded
visual decisions:

- Express each primitive's appearance as **Tailwind utility classes in
  `packages/ui/src/theme/variants.ts`**, keyed by primitive and state (for
  example `badge.on`, `badge.offline`, `valve.active`, `valve.pending`,
  `button.primary`, `button.danger`, `button.disabled`, `phase.default`,
  `phase.fertigation`, `phase.narrow`, `card`, `dialog`, `menu`).
- Primitives in `packages/ui/src/*.tsx` must consume **only** the variant map for
  visuals, never literal utility strings and never semantic CSS class names.
  Behaviour (focus trap, ARIA, keyboard, timers) stays exactly as it is.
- Drive colours, fonts and border weights from the `@theme` tokens already in
  `packages/ui/src/theme/eink.css` so they are actually referenced.
- Layout that is genuinely app-level (the `main` grid and its row/column spans,
  the masthead, the responsive `@media (max-width: 640px)` block) may stay as CSS
  in the app, but must be trimmed to just that. The per-primitive rules must not
  remain duplicated there.
- Keep the global reset that kills animation, transitions, rounded corners and
  shadows. Tailwind's preflight emits `border-radius`, `box-shadow`, `gradient`
  and `transition` declarations, and the reset is what keeps DESIGN.md's e-ink
  rules true. **Preferably also disable Tailwind preflight** if that is
  straightforward in v4, so those declarations never reach the bundle; if not,
  keep the `!important` reset and say so in the report.

### Non-negotiable: this must not change how the page looks

Parity is already achieved and must survive the refactor. Before you start,
capture the current rendered appearance so you can prove nothing moved — the
translation must be rule-by-rule against the existing CSS, not an
approximation. Pay particular attention to the idioms:

- filled black = active (`badge.on`, `dot.on`, `valve.active`,
  `phase-fertigation`)
- dashed border = not committed / offline (`badge.offline`, `valve.pending`)
- `#B00020` danger only where the current CSS uses it
- the valve status line keeps its height while empty (no layout shift)
- `min-height` on the menu reason and dialog status lines
- the `#event-log:empty::after` empty-state text
- tabular numerals and the numeric font on metrics, phase numbers and log times

Verify with the checks already in the plan: grep the built CSS and confirm no
rounded corners, shadows, gradients or motion survive in effect.

---

## Report

Update `report.md` to state plainly, for each gap, what is now covered and what
is not. If you consciously leave something out, say so explicitly rather than
omitting it — the previous report's silence about the missing integration suite
cost a review cycle.

---

## Appearance baseline

A copy of the current `apps/dashboard/src/styles.css` is saved alongside this
file as `styles-baseline.css`. Use it as the rule-by-rule reference for the
Gap 2 translation, and diff your variant map against it. It is a reference
artefact only — do not import it, and do not edit it.

---

# Guidance — round 3

Both gaps are genuinely closed. Verified independently:

- Bare `bun test` runs 20 tests, all passing, via `bunfig.toml` preload.
- The integration suite uses a real `aedes` broker over WS on an ephemeral port.
- Mutation-tested the suite: removing the `Flow active` guard fails 2 tests, and
  making the reset publish retained fails 2 tests. The tests have teeth.
- `variants.ts` is now a real Tailwind utility map; `styles.css` is down from 467
  to 13 lines and holds only masthead, grid and responsive rules.
- Preflight is genuinely disabled (`theme.css` + `utilities.css` imports).

Three **visual regressions** were introduced by the Gap 2 refactor. Fix these and
nothing else. Do not restructure the variant map further.

## 3a. Badge padding is transposed (visible bug)

`dashboard/site/style.css:88` (and `styles-baseline.css`) has:

```css
padding: 0.35rem 0.7rem;   /* 0.35rem vertical, 0.7rem horizontal */
```

`variants.ts` `badge.base` currently has `px-[0.35rem] py-[0.7rem]` — the axes
are swapped, so badges are too tall and too narrow. It must be
`px-[0.7rem] py-[0.35rem]`.

Check every other shorthand you converted for the same transposition. CSS
`padding: A B` is vertical A, horizontal B — `py-A px-B`.

## 3b. `:focus-visible` is no longer global (accessibility regression)

The baseline applies the focus ring to **every** focusable element:

```css
:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
```

Now it only exists inside `baseButton`. So the duration number inputs, the menu
trigger, the menu item, the relay toggle and the valve segment buttons have lost
their visible focus indicator. That breaks keyboard accessibility and DESIGN.md's
high-contrast intent.

Restore it as a global rule in `packages/ui/src/theme/eink.css` (next to the
existing reset), and remove the now-redundant `focus-visible:*` utilities from
`baseButton` so there is exactly one source for the focus ring.

## 3c. Two dropped rules

- `html { scroll-behavior: auto; }` survived, good — but confirm
  `#event-log`'s `max-h-60` equals the original `max-height: 240px`.
  Tailwind's `max-h-60` is `calc(var(--spacing) * 60)` = `15rem` = 240px at the
  default 0.25rem spacing, so this is correct — just verify, do not change.
- The responsive block lost `.card { padding: 1.25rem }`? No — that moved to
  `card`'s `max-[640px]:p-5` (1.25rem). Correct. But the baseline's
  `@media (max-width: 640px) { .phase { padding: 0.4rem 0.6rem } }` set **both**
  axes; `phase.base` currently only overrides the horizontal
  (`max-[640px]:px-[0.6rem]`) and keeps `py-2` (0.5rem) instead of 0.4rem.
  Add the vertical override so the mobile phase padding matches.

## Verify

Re-run `bun run typecheck`, `bun test` (all 20 must still pass) and
`bun run build`. Then diff your variant map against `styles-baseline.css` once
more, specifically checking **every** multi-value shorthand (`padding`, `margin`,
`inset`) for axis order. Report in `report.md` what you found and fixed, and
state explicitly whether any other transposition existed.
