#pragma once
// Dry-run watchdog (controller ADR-0005). The 1 s check that trips on sustained
// low flow past the priming grace: phase-aware, so Fertigation starts a recovery
// flush while any other phase stops dead. Split out of the interval lambda for
// readability (ADR-0014); couples to ESPHome directly, so it relies on being
// included last, after the generated entity globals.
#include <cmath>
#include "watering_events.h"  // watering_set_pending_outcome()

// File-scoped RAM working state (ADR-0014).
inline uint32_t g_pump_on_since_ms = 0;  // millis() at last pump-on; drives the 15 s priming grace
inline int g_low_flow_secs = 0;          // consecutive low-flow seconds; the 3 s confirm window

// Called from the pump on_turn_on: start the priming grace, clear the counter.
inline void watchdog_arm() {
  g_pump_on_since_ms = millis();
  g_low_flow_secs = 0;
}

inline void watchdog_tick() {
  if (!pump->state) { g_low_flow_secs = 0; return; }
  if (millis() - g_pump_on_since_ms < 15000) { g_low_flow_secs = 0; return; }
  if (std::isnan(flow_pulses->state)) return;
  if (flow_pulses->state < min_flow_lpm->state) {
    g_low_flow_secs++;
  } else {
    g_low_flow_secs = 0;
  }
  if (g_low_flow_secs >= 3) {
    g_low_flow_secs = 0;
    if (current_phase->value() == 2) {
      recovery_flush->execute();
      ESP_LOGW("flow", "dry-run detected during fertigation; recovery flush starting");
      recovery_flush_publish->execute();
    } else {
      watering_set_pending_outcome(2);
      abort_irrigation->execute();
      ESP_LOGW("flow", "dry-run detected: no flow with pump on, aborting");
    }
    dry_run_publish->execute();
  }
}
