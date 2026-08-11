#pragma once
// The pump's open-path invariant (controller ADR-0016). The pump may run only
// with at least one open source upstream AND at least one open zone downstream;
// an open source with every zone shut deadheads it, driving it toward its
// 3.8 bar cutoff current (~7.5 A) against a 10 A BMS with no restart headroom.
//
// Checked in two places, because a single check is not enough: on every valve
// close (a valve going shut can break a path the pump is using) and on pump-on
// (a start with nothing open would otherwise deadhead for the dry-run
// watchdog's entire ~18 s priming-plus-confirm window). Couples to ESPHome
// directly via the generated globals, so it relies on being included last
// (ADR-0014).

inline bool pump_has_open_path() {
  const bool source_open = clean_water_valve->state || fertigation_valve->state || microbiology_valve->state;
  const bool zone_open = zone_1->state || zone_2->state || zone_3->state || zone_4->state;
  return source_open && zone_open;
}
