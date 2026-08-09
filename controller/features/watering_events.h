#pragma once
// Watering-event lifecycle (controller ADR-0012). Opens an event on the first
// pump-on and closes it on a real pump-off, writing a WateringRecord to the NVS
// ring buffer (watering_log.h) and publishing over MQTT. Split out of the pump
// switch lambdas for readability (ADR-0014); couples to ESPHome directly via the
// generated globals, so it relies on being included last — ESPHome appends
// `includes:` after the entity declarations.
#include "watering_log.h"

// File-scoped RAM working state for the currently-open event (ADR-0014: RAM-only
// working scalars live in their feature header, not ESPHome `globals:`).
inline bool g_event_open = false;
inline uint32_t g_event_seq = 0;
inline uint32_t g_event_start_epoch = 0;  // Unix epoch seconds, or 0 = clock unset
inline double g_event_start_l = 0;        // water_total_l at pump-on
inline uint8_t g_event_trigger = 0;       // 0 sequence, 1 manual
inline uint8_t g_pending_outcome = 0;     // 0 completed, 1 aborted, 2 dry_run, 3 recovery
inline uint8_t g_next_trigger = 0;        // trigger for the next event to open
inline bool g_pump_handover = false;      // suppress close during a sequence handover

// Setters called from YAML scripts (sequence/manual/stop) and the watchdog.
inline void watering_set_next_trigger(uint8_t t) { g_next_trigger = t; }
inline void watering_set_handover(bool h) { g_pump_handover = h; }
inline void watering_set_pending_outcome(uint8_t o) { g_pending_outcome = o; }

inline void watering_event_pump_on() {
  // Open a watering event on the first pump-on; a mid-sequence handover
  // (pump toggles off then on) leaves the event open, so this is a no-op then.
  if (!g_event_open) {
    g_event_open = true;
    g_event_seq = g_watering_log.next_seq;
    g_watering_log.next_seq++;
    // 0 is the "clock not set" sentinel; the server stores it as null.
    g_event_start_epoch = rtc_time->now().is_valid() ? (uint32_t) rtc_time->now().timestamp : 0;
    g_event_start_l = water_total_l->value();
    g_event_trigger = g_next_trigger;
    g_pending_outcome = 0;
  }
}

inline void watering_event_pump_off() {
  // Close the event on any real pump-off; a handover pump-off is skipped.
  if (g_event_open && !g_pump_handover) {
    WateringRecord r;
    r.seq = g_event_seq;
    r.start = g_event_start_epoch;
    r.end = rtc_time->now().is_valid() ? (uint32_t) rtc_time->now().timestamp : 0;
    double dl = water_total_l->value() - g_event_start_l;
    r.litres = dl < 0 ? 0.0f : (float) dl;
    r.outcome = g_pending_outcome;
    r.trigger = g_event_trigger;
    r.channel = 0;
    watering_log_append(g_watering_log, r);
    g_event_open = false;
    watering_log_save();
    std::string ev = watering_record_json(App.get_name().c_str(), r);
    std::string lg = watering_log_json(App.get_name().c_str(), g_watering_log);
    mqtt::global_mqtt_client->publish("kc868-a8/watering/log", lg, 0, true);
    mqtt::global_mqtt_client->publish("kc868-a8/watering/event", ev, 0, false);
  }
}

// Retained-log refresh on MQTT (re)connect, so the server backfills on ingest.
inline void watering_log_publish_retained() {
  std::string lg = watering_log_json(App.get_name().c_str(), g_watering_log);
  mqtt::global_mqtt_client->publish("kc868-a8/watering/log", lg, 0, true);
}
