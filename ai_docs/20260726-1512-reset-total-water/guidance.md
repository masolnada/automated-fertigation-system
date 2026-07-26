# Architect review guidance

The first implementation compiles and broadly matches the approved plan. Before
final completion, fix these dashboard state-machine issues and update
`report.md`.

## Required fixes

1. **Handle reset results even when this dashboard did not initiate the reset.**
   `handleResetResult()` currently returns before logging unless a reset dialog
   is pending. Results from the native ESPHome button must still appear in the
   custom dashboard event log. Log `success`/`already_zero` normally and all
   rejection/error/unknown payloads as danger. Only gate dialog mutation on an
   active pending reset; do not gate event logging.

2. **Do not allow dismissal while a reset request is pending.**
   Cancel is disabled, but Escape and backdrop click currently call
   `closeDialog()` and clear `resetState.pending`, allowing duplicate requests
   and causing the eventual result to be ignored. While pending, ignore Escape
   and backdrop dismissal. Successful/already-zero result must still be able to
   force-close the dialog. Timeout ends pending and restores normal dismissal.

3. **Invalidate safety state across MQTT disconnect/reconnect.**
   Pump/flow/total `*Known` flags survive a disconnect. Because `deviceOnline`
   also remains true on broker close, reconnect can briefly enable reset from
   stale retained state before fresh MQTT states arrive. On broker close (and
   defensively at connect before subscriptions settle), mark device offline and
   clear `pumpKnown`, `flowKnown`, and `totalKnown`. Keep displayed values if
   desired, but reset eligibility must wait for fresh state messages and a fresh
   online availability message.

4. **Re-enable reset confirmation when conditions recover.**
   `updateResetUi()` disables the open reset dialog when conditions become
   unsafe, but never re-enables it when pump/flow/connectivity become safe again.
   Whenever a reset dialog is open and not pending, set confirm disabled state
   from current eligibility on every update. Preserve useful rejection/timeout
   text, but permit retry after prerequisites recover.

5. Add concise comments where needed and keep the no-animation/design-system
   constraints. Do not broaden scope.

## Re-run verification

- `node --check dashboard/site/app.js`
- no `confirm(` calls
- ESPHome config if available (sandbox may still lack it)
- Grafana JSON parse
- TOML structural parse using an available Python version/library
- `git diff --check`

Update `report.md` to describe the fixes. Do not modify `plan.md`.

## Second review: final small corrections

The first guidance was mostly addressed. Fix these remaining UI consistency
issues:

1. `updateResetUi()` re-enables confirmation when conditions recover, but leaves
   the old dynamic `Reset unavailable: ...` status visible because
   `dialog.errorStatus` remains false and there is no safe-state clear branch.
   When eligibility becomes safe and there is no rejection/timeout error status,
   clear the dynamic status so the dialog does not simultaneously say
   unavailable and offer an enabled Reset button. Preserve actual rejection or
   timeout text (`errorStatus == true`).

2. Distinguish an invalid/non-finite Total Water payload from zero in
   `resetIneligibleReason()`. Return a reason such as `Total unknown` for NaN;
   reserve `Already zero` for a finite value `<= 0`.

3. On a device `status=offline` message while the broker remains connected,
   invalidate `pumpKnown`, `flowKnown`, and `totalKnown`. Otherwise a later
   `status=online` can briefly enable reset from pre-offline state before fresh
   retained/entity states arrive. The broker-close invalidation is already
   correct; apply the same safety principle to device availability transitions.

Re-run JS syntax and diff checks, then update `report.md` once more.
