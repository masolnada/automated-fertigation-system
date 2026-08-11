#pragma once
// Device-authoritative watering-event log (controller ADR-0012). A fixed-size
// ring buffer of completed watering events, persisted whole in NVS (ADR-0011)
// and serialized to JSON for the two MQTT topics. Structs + serialization are
// plain C++; the ring instance and its whole-blob NVS persistence use ESPHome
// preferences (this is the sole header that owns persistent state, per ADR-0014).
#include <cstdint>
#include <cstdio>
#include <string>
#include "esphome/core/preferences.h"

static const uint16_t WATERING_LOG_N = 192;

// outcome: 0 completed, 1 aborted, 2 dry_run, 3 recovery. trigger: 0 sequence,
// 1 manual. zone is the zone watered, 0 meaning none was recorded (the server
// maps that to null, as it does the epoch-0 clock sentinel).
struct WateringRecord {
  uint32_t seq;
  uint32_t start;  // Unix epoch seconds (RTC)
  uint32_t end;
  float litres;
  uint8_t outcome;
  uint8_t trigger;
  uint8_t zone;
};

struct WateringLog {
  uint32_t next_seq;  // durable monotonic; the dedup key
  uint16_t head;      // next write slot
  uint16_t count;     // valid records, <= N
  WateringRecord slots[WATERING_LOG_N];
};

inline const char *watering_outcome_str(uint8_t o) {
  switch (o) {
    case 1: return "aborted";
    case 2: return "dry_run";
    case 3: return "recovery";
    default: return "completed";
  }
}
inline const char *watering_trigger_str(uint8_t t) { return t == 1 ? "manual" : "sequence"; }

// The single ring-buffer instance and its NVS-backed preference. Kept in the
// header (not an ESPHome `globals:` entry) so `WateringLog` is complete before
// use — ESPHome declares typed globals before including this file.
inline WateringLog g_watering_log;
inline esphome::ESPPreferenceObject g_watering_pref;

inline void watering_log_init() {
  g_watering_pref = esphome::global_preferences->make_preference<WateringLog>(0x57544C47);  // "WTLG"
  if (!g_watering_pref.load(&g_watering_log)) g_watering_log = WateringLog{};
}
inline void watering_log_save() {
  g_watering_pref.save(&g_watering_log);
  esphome::global_preferences->sync();
}

inline void watering_log_append(WateringLog &log, const WateringRecord &rec) {
  log.slots[log.head] = rec;
  log.head = (log.head + 1) % WATERING_LOG_N;
  if (log.count < WATERING_LOG_N) log.count++;
}

inline void watering_event_json(std::string &out, const WateringRecord &r) {
  char buf[192];
  snprintf(buf, sizeof(buf),
           "{\"seq\":%u,\"start\":%u,\"end\":%u,\"litres\":%.3f,\"outcome\":\"%s\",\"trigger\":\"%s\",\"zone\":%u}",
           (unsigned) r.seq, (unsigned) r.start, (unsigned) r.end, r.litres,
           watering_outcome_str(r.outcome), watering_trigger_str(r.trigger),
           (unsigned) r.zone);
  out += buf;
}

// One event for the non-retained `watering/event` topic (Telegraf).
inline std::string watering_record_json(const char *device, const WateringRecord &r) {
  std::string out = "{\"device\":\"";
  out += device;
  out += "\",";
  std::string body;
  watering_event_json(body, r);
  out += body.substr(1);  // drop the body's leading '{'
  return out;
}

// The whole ring, oldest-first, for the retained `watering/log` topic (server).
inline std::string watering_log_json(const char *device, const WateringLog &log) {
  std::string out = "{\"device\":\"";
  out += device;
  out += "\",\"events\":[";
  uint16_t first = (log.head + WATERING_LOG_N - log.count) % WATERING_LOG_N;
  for (uint16_t i = 0; i < log.count; i++) {
    if (i > 0) out += ",";
    watering_event_json(out, log.slots[(first + i) % WATERING_LOG_N]);
  }
  out += "]}";
  return out;
}
