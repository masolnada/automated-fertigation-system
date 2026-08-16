#pragma once
// Device-side irrigation scheduling (controller ADR-0018). The controller holds
// the schedule and fires it from its own RTC, because it spends weeks in the
// field with no network (ADR-0012) and carries a clock for exactly this reason
// (ADR-0013) — a scheduler that only ran while the server could reach it would
// contradict the deployment.
//
// The set is authored on the server and delivered whole on the retained
// `schedule/set` topic; this file stores it in NVS and decides what fires. Like
// watering_log.h it owns persistent state, so it holds its own preference
// object (ADR-0014).
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include "esphome/core/preferences.h"

static const uint8_t SCHEDULE_N = 16;

// One standing instruction, self-contained: it carries its own recipe rather
// than reading the device's globals, so two entries can water differently and a
// scheduled run never disturbs what the manual button will next do (ADR-0018).
//
// Frequency is one of two forms, never both. `mask` non-zero means weekdays (bit
// 0 = Monday); otherwise `every` days counted from `from_day`. Both are pure
// functions of the date, so a power cut changes nothing — counting from the last
// run would push the cadence later every time the device was dark.
struct ScheduleEntry {
  char id[37];         // server UUID; the dedup key when a set is replaced
  uint8_t hour;
  uint8_t minute;
  uint8_t mask;        // weekday bitmask, bit 0 = Monday; 0 = use every/from_day
  uint8_t every;       // fire every N days
  uint32_t from_day;   // anchor, days since Unix epoch
  uint8_t channel;     // output channel to water, 1-4
  uint8_t volume;      // 1 = Volume mode, 0 = Time
  float total;         // litres or minutes, per `volume`
  float prewet;        // percent of the total given to pre-wet
  float flush;         // flush minutes
};

struct ScheduleSet {
  uint8_t count;
  ScheduleEntry entries[SCHEDULE_N];
};

inline ScheduleSet g_schedules;
inline esphome::ESPPreferenceObject g_schedule_pref;
// The minute each entry last fired, as (days_since_epoch * 1440 + minute-of-day).
// RAM only and deliberately not persisted: it exists solely to stop one entry
// firing twice within its own minute, and a reboot inside that minute is both
// rare and harmless — the sequence is `mode: single`, so a duplicate start while
// the first is still running is dropped anyway.
inline uint32_t g_schedule_last_fired[SCHEDULE_N];

inline void schedules_init() {
  g_schedule_pref = esphome::global_preferences->make_preference<ScheduleSet>(0x53434844);  // "SCHD"
  if (!g_schedule_pref.load(&g_schedules)) g_schedules = ScheduleSet{};
  if (g_schedules.count > SCHEDULE_N) g_schedules = ScheduleSet{};
  memset(g_schedule_last_fired, 0, sizeof(g_schedule_last_fired));
}

inline void schedules_save() {
  g_schedule_pref.save(&g_schedules);
  esphome::global_preferences->sync();
}

// Does `entry` fire on this date? Pure function of the calendar, as above.
// `weekday` is 1=Sunday..7=Saturday (ESPHome's convention); `day_number` is days
// since the Unix epoch.
inline bool schedule_fires_on(const ScheduleEntry &entry, uint8_t weekday, uint32_t day_number) {
  if (entry.mask != 0) {
    // ESPHome's 1=Sunday to our bit 0=Monday.
    uint8_t monday_index = (weekday + 5) % 7;
    return (entry.mask & (1 << monday_index)) != 0;
  }
  if (entry.every == 0 || day_number < entry.from_day) return false;
  return ((day_number - entry.from_day) % entry.every) == 0;
}

// Replace the whole set from the server's JSON. Whole-set replacement rather
// than per-entry edits: an entry is immutable (web ADR-0017), and a retained
// topic carrying the complete set is what lets a reconnecting device catch up
// with no reconciliation. Returns the number of entries parsed, or -1 on a
// malformed payload — in which case the previous set is kept, since dropping
// every schedule because one byte was wrong would silently stop all watering.
inline int schedules_apply_json(const char *payload) {
  ScheduleSet next{};
  const char *cursor = strstr(payload, "\"entries\"");
  if (cursor == nullptr) return -1;
  while ((cursor = strchr(cursor, '{')) != nullptr && next.count < SCHEDULE_N) {
    ScheduleEntry entry{};
    const char *id = strstr(cursor, "\"id\":\"");
    if (id == nullptr || id > strchr(cursor, '}')) break;
    id += 6;
    const char *id_end = strchr(id, '"');
    if (id_end == nullptr) return -1;
    size_t id_len = (size_t) (id_end - id);
    if (id_len >= sizeof(entry.id)) id_len = sizeof(entry.id) - 1;
    memcpy(entry.id, id, id_len);
    entry.id[id_len] = '\0';

    auto number = [&](const char *key, float fallback) -> float {
      char needle[24];
      snprintf(needle, sizeof(needle), "\"%s\":", key);
      const char *found = strstr(cursor, needle);
      const char *end = strchr(cursor, '}');
      if (found == nullptr || (end != nullptr && found > end)) return fallback;
      return (float) atof(found + strlen(needle));
    };

    entry.hour = (uint8_t) number("hour", 0);
    entry.minute = (uint8_t) number("minute", 0);
    entry.mask = (uint8_t) number("mask", 0);
    entry.every = (uint8_t) number("every", 0);
    entry.from_day = (uint32_t) number("from", 0);
    entry.channel = (uint8_t) number("channel", 0);
    entry.volume = (uint8_t) number("volume", 0);
    entry.total = number("total", 0);
    entry.prewet = number("prewet", 0);
    entry.flush = number("flush", 1);

    // A channel outside 1-4 would water nowhere, and a zero-length flush would
    // leave residue in the lines — both are refused at the boundary rather than
    // stored and discovered at 6am.
    if (entry.channel >= 1 && entry.channel <= 4 && entry.hour < 24 && entry.minute < 60 && entry.flush >= 1) {
      next.entries[next.count] = entry;
      next.count++;
    } else {
      ESP_LOGW("schedule", "rejecting malformed entry %s", entry.id);
    }
    cursor = strchr(cursor, '}');
    if (cursor == nullptr) break;
    cursor++;
  }
  g_schedules = next;
  memset(g_schedule_last_fired, 0, sizeof(g_schedule_last_fired));
  schedules_save();
  return next.count;
}
