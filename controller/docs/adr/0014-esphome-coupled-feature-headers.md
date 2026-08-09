# Feature logic lives in ESPHome-coupled headers, not pure/testable cores

Each self-contained feature — reset, the dry-run watchdog, watering-event
lifecycle — moves its logic out of the YAML lambdas into its own header
(`reset.h`, `watchdog.h`, `watering_events.h`), beside the existing
`watering_log.h`. The YAML lambda for each shrinks to a one-line call. The goal
is readability: the `kc868-a8.yaml` file becomes a scannable manifest of entities
and pins, with the dense multi-line logic named and grouped by feature.

These headers couple directly to ESPHome — they call `id(...)`, `mqtt`, and
`global_preferences` inline, exactly like `watering_log.h`'s NVS glue does. They
are deliberately *not* split into pure, ESPHome-free cores with a native test
harness. A future reader should not "improve" them into pure/testable cores
without re-reading the rationale below.

## Considered options

A pure-core + adapter split was designed and rejected. The idea was an
ESPHome-free `*_core.h` per feature (POD structs + pure decision functions like
`reset_evaluate` / `watchdog_decide`), unit-tested off-device with plain `g++`,
plus a thin adapter reading `id(...)` and applying effects.

It was dropped because it targets the wrong risk surface:

- **The bugs this firmware actually has are not pure-logic bugs.** The confirmed
  ones were timing, hardware, and ESPHome-runtime issues — the Arduino BLE boot
  loop (ADR-0008), reboot-on-relay-switch (brownout), the API/MQTT no-client
  watchdog rebooting every 15 min, the pump-handover event split, the reset
  needing a `delay: 1s` before `sync()`. A `decide()` unit test catches none of
  these.
- **The dangerous logic can't be tested off-device anyway.** The pump/valve
  choreography — `turn_off` → `delay 2s` → swap valve → `turn_on`, the handover
  flag, the watchdog-interval/sequence interplay — is built from ESPHome actions
  with `delay:` and stays in YAML regardless. Testing the guard truth-tables
  would put a green checkmark on the low-risk surface while the flood/dry-run
  surface stayed untested — false confidence.
- **The host toolchain can lie.** Native `g++` is not the ESP32 IDF toolchain;
  a test can pass on the host while the device differs.
- **HIL supervision is mandatory regardless.** One full sequence is supervised on
  hardware before the controller is trusted unattended; unit tests do not shrink
  that, so their marginal safety gain is near zero.

Readability — the actual goal — needs none of the pure-core apparatus.

## Consequences

- Feature logic references ESPHome symbols directly; the headers are not
  compilable or testable in isolation. This is intended.
- **Persisted** scalars stay in YAML `globals:` for ESPHome's free `restore_value`
  NVS persistence (`water_total_l`, `last_total_pulses`). **RAM-only** working
  scalars are file-scoped in their feature header (`watchdog.h`'s
  `g_pump_on_since_ms`/`g_low_flow_secs`; `watering_events.h`'s `g_event_*` /
  `g_next_trigger` / `g_pending_outcome` / `g_pump_handover`), set from YAML via
  small `*_set_*` functions — no ESPHome global, no `->value()`. A scalar shared
  between a YAML feature and a header feature stays a global (`current_phase`:
  written by the sequence, read by the watchdog). A header owns whole-blob NVS
  state only in `watering_log.h`'s ring buffer.
- The rule for future features: stateful/branchy logic goes to an
  ESPHome-coupled `*.h`; action/`delay:` choreography and one-liners stay in
  YAML. The irrigation sequence, flow metering, and battery detection stay inline
  for that reason.
