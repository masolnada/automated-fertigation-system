#pragma once
// Guarded, irreversible Total Water reset (controller ADR-0007). Split out of the
// reset_total_water script for readability (ADR-0014); couples to ESPHome
// directly, so it relies on being included last, after the generated entity
// globals. The 1 s delay between prepare() and finalize() — which lets the
// restoring global stage zero before sync() — stays in YAML, since a blocking
// delay cannot live in a C++ function.
#include <cmath>

// Guard chain, then zero. Each rejection (pump running / flow unknown / flow
// active) and the already-zero skip publishes its result and returns false. On a
// clean path it zeroes water_total_l and returns true, so YAML runs the 1 s delay
// then reset_finalize().
inline bool reset_prepare() {
  if (pump->state) {
    ESP_LOGW("flow", "total-water reset rejected: pump running");
    mqtt::global_mqtt_client->publish("kc868-a8/flow/reset_total/result", std::string("rejected_pump_running"), 0, false);
    return false;
  }
  if (std::isnan(flow_pulses->state)) {
    ESP_LOGW("flow", "total-water reset rejected: flow unknown");
    mqtt::global_mqtt_client->publish("kc868-a8/flow/reset_total/result", std::string("rejected_flow_unknown"), 0, false);
    return false;
  }
  if (flow_pulses->state >= 0.1f) {
    ESP_LOGW("flow", "total-water reset rejected: flow active");
    mqtt::global_mqtt_client->publish("kc868-a8/flow/reset_total/result", std::string("rejected_flow_active"), 0, false);
    return false;
  }
  if (std::fabs(water_total_l->value()) < 0.000001) {
    ESP_LOGI("flow", "total-water reset skipped: already zero");
    mqtt::global_mqtt_client->publish("kc868-a8/flow/reset_total/result", std::string("already_zero"), 0, false);
    return false;
  }
  water_total_l->value() = 0.0;
  return true;
}

// After the delay lets the restoring global stage zero: persist and report. RAM
// is already zero; if the sync fails it may not survive a reboot, so report the
// live value and an error rather than a false success.
inline void reset_finalize() {
  const bool ok = global_preferences->sync();
  if (ok) {
    total_water->publish_state(0.0);
    ESP_LOGI("flow", "total-water reset persisted successfully");
    mqtt::global_mqtt_client->publish("kc868-a8/flow/reset_total/result", std::string("success"), 0, false);
  } else {
    // RAM is zero, but it may not survive reboot after this error.
    total_water->publish_state(water_total_l->value());
    ESP_LOGE("flow", "total-water reset persistence failed");
    mqtt::global_mqtt_client->publish("kc868-a8/flow/reset_total/result", std::string("error_persistence"), 0, false);
  }
}
