import { describe, expect, test } from "bun:test";
import { OutputChannel } from "../src/shared-kernel/output-channel";
import { cycleMode } from "../src/modules/irrigation/domain/cycle-mode";
import { CycleTarget } from "../src/modules/irrigation/domain/cycle-target";
import { PreWetPercentage } from "../src/modules/irrigation/domain/pre-wet-percentage";
import { FlushDuration } from "../src/modules/irrigation/domain/flush-duration";
import { MinimumFlow } from "../src/modules/irrigation/domain/minimum-flow";
import { CycleRecipe } from "../src/modules/irrigation/domain/cycle-recipe";
import { ZoneId } from "../src/modules/zones/domain/zone-id";
import { ZoneName } from "../src/modules/zones/domain/zone-name";
import { Zone } from "../src/modules/zones/domain/zone";
import { AssignmentTable } from "../src/modules/zones/domain/assignment-table";
import { CalendarDate } from "../src/modules/scheduling/domain/calendar-date";
import { TimeOfDay } from "../src/modules/scheduling/domain/time-of-day";
import { IsoWeekday } from "../src/modules/scheduling/domain/iso-weekday";
import { WeekdaySet } from "../src/modules/scheduling/domain/weekday-set";
import { EveryNDaysFrequency, Frequency, WeekdayFrequency } from "../src/modules/scheduling/domain/frequency";
import { ScheduleId } from "../src/modules/scheduling/domain/schedule-id";
import { ScheduleEntry } from "../src/modules/scheduling/domain/schedule-entry";
import { ScheduleBook } from "../src/modules/scheduling/domain/schedule-book";
import { DeviceId } from "../src/modules/watering/domain/device-id";
import { WateringEventSequence } from "../src/modules/watering/domain/watering-event-sequence";
import { LitresDelivered } from "../src/modules/watering/domain/litres-delivered";
import { WateringOutcome } from "../src/modules/watering/domain/watering-outcome";
import { WateringTrigger } from "../src/modules/watering/domain/watering-trigger";
import { DeviceTimestamp } from "../src/modules/watering/domain/device-timestamp";
import { WateringTimeRange } from "../src/modules/watering/domain/watering-time-range";
import { WateringEventId } from "../src/modules/watering/domain/watering-event-id";
import { WateringEvent } from "../src/modules/watering/domain/watering-event";

const value = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => { if (!result.ok) throw result.error; return result.value; };
const uuid = () => crypto.randomUUID();

describe("shared and zone value objects", () => {
  test("OutputChannel accepts only 1-4 and round-trips by value", () => {
    for (const n of [1, 2, 3, 4] as const) expect(OutputChannel.rehydrate(n).toNumber()).toBe(n);
    for (const n of [0, 5, 1.5, "1"]) expect(OutputChannel.create(n).ok).toBe(false);
    expect(OutputChannel.rehydrate(2).equals(OutputChannel.rehydrate(2))).toBe(true);
  });
  test("ZoneId validates UUID identity", () => {
    const id = uuid(); expect(ZoneId.rehydrate(id).toString()).toBe(id); expect(ZoneId.rehydrate(id).equals(ZoneId.rehydrate(id))).toBe(true); expect(ZoneId.create("zone-1").ok).toBe(false);
  });
  test("ZoneName trims, bounds and compares normalized values", () => {
    expect(ZoneName.rehydrate("  Olive terrace  ").toString()).toBe("Olive terrace"); expect(ZoneName.rehydrate(" Olive terrace ").equals(ZoneName.rehydrate("Olive terrace"))).toBe(true);
    expect(ZoneName.create("").ok).toBe(false); expect(ZoneName.create("x".repeat(40)).ok).toBe(true); expect(ZoneName.create("x".repeat(41)).ok).toBe(false);
  });
  test("Zone transitions preserve identity and are idempotent", () => {
    const zone = Zone.create(ZoneId.rehydrate(uuid()), ZoneName.rehydrate("One")); const archived = zone.archive();
    expect(archived.id.equals(zone.id)).toBe(true); expect(archived.archive()).toBe(archived); expect(archived.unarchive().archived).toBe(false); expect(zone.rename(ZoneName.rehydrate("One"))).toBe(zone);
  });
  test("AssignmentTable owns eligibility and one-to-one invariants", () => {
    const first = ZoneId.rehydrate(uuid()), second = ZoneId.rehydrate(uuid());
    const table = value(AssignmentTable.create({ 1: first.toString(), 2: second.toString(), 3: null, 4: null }, [first, second]));
    expect(table.toRecord()).toEqual({ 1: first.toString(), 2: second.toString() }); expect(table.equals(AssignmentTable.rehydrate(table.entries()))).toBe(true);
    expect(AssignmentTable.create({ 1: first.toString(), 2: first.toString() }, [first]).ok).toBe(false); expect(AssignmentTable.create({ 5: first.toString() }, [first]).ok).toBe(false); expect(AssignmentTable.create({ 1: uuid() }, [first]).ok).toBe(false);
  });
});

describe("irrigation value objects", () => {
  test("CycleMode is closed", () => { expect(value(cycleMode("Time"))).toBe("Time"); expect(value(cycleMode("Volume"))).toBe("Volume"); expect(cycleMode("Drip").ok).toBe(false); });
  test("CycleTarget is mode-aware at every boundary", () => {
    for (const [mode, valid, invalid] of [["Time", [0, 180], [-1, 181]], ["Volume", [0, 500], [-1, 501]]] as const) { for (const n of valid) expect(CycleTarget.create(mode, n).ok).toBe(true); for (const n of invalid) expect(CycleTarget.create(mode, n).ok).toBe(false); }
    expect(CycleTarget.rehydrate("Time", 30).equals(CycleTarget.rehydrate("Time", 30))).toBe(true);
  });
  test("PreWetPercentage, FlushDuration and MinimumFlow enforce machine limits", () => {
    for (const n of [0, 100]) expect(PreWetPercentage.create(n).ok).toBe(true); for (const n of [-1, 101, Number.NaN]) expect(PreWetPercentage.create(n).ok).toBe(false);
    for (const n of [1, 60]) expect(FlushDuration.create(n).ok).toBe(true); for (const n of [0, 61]) expect(FlushDuration.create(n).ok).toBe(false);
    for (const n of [0, 10]) expect(MinimumFlow.create(n).ok).toBe(true); for (const n of [-0.1, 10.1]) expect(MinimumFlow.create(n).ok).toBe(false);
    expect(FlushDuration.rehydrate(5).equals(FlushDuration.rehydrate(5))).toBe(true);
  });
  test("CycleRecipe validates and round-trips as one immutable value", () => {
    const raw = { mode: "Volume", total: 200, preWetPercent: 20, flushMinutes: 5 } as const; const recipe = CycleRecipe.rehydrate(raw);
    expect(recipe.toPrimitives()).toEqual(raw); expect(recipe.equals(CycleRecipe.rehydrate(recipe.toPrimitives()))).toBe(true); expect(CycleRecipe.create({ ...raw, flushMinutes: 0 }).ok).toBe(false); expect(CycleRecipe.create(null).ok).toBe(false);
  });
});

describe("scheduling value objects", () => {
  test("TimeOfDay strictly parses, formats and compares", () => {
    expect(TimeOfDay.rehydrate("00:00").toString()).toBe("00:00"); expect(TimeOfDay.rehydrate("23:59").toString()).toBe("23:59"); expect(TimeOfDay.rehydrate("06:00").compare(TimeOfDay.rehydrate("06:01"))).toBeLessThan(0);
    for (const raw of ["6:00", "24:00", "06:60", "06:00:00"]) expect(TimeOfDay.create(raw).ok).toBe(false);
  });
  test("CalendarDate rejects impossible dates and round-trips epoch days", () => {
    for (const raw of ["2024-02-29", "2026-01-01", "2026-12-31"]) { const date = CalendarDate.rehydrate(raw); expect(CalendarDate.fromEpochDay(date.toEpochDay()).equals(date)).toBe(true); expect(date.toString()).toBe(raw); }
    for (const raw of ["2026-02-29", "2026-02-31", "2026-13-01", "14-03-2026"]) expect(CalendarDate.create(raw).ok).toBe(false);
  });
  test("IsoWeekday and WeekdaySet normalize, compare and encode a mask", () => {
    expect(IsoWeekday.fromEpochDay(CalendarDate.rehydrate("2026-03-16").toEpochDay()).toNumber()).toBe(1);
    const days = WeekdaySet.rehydrate([5, 2, 5]); expect(days.toNumbers()).toEqual([2, 5]); expect(days.toBitMask()).toBe((1 << 1) | (1 << 4)); expect(days.equals(WeekdaySet.rehydrate([2, 5]))).toBe(true);
    expect(WeekdaySet.create([]).ok).toBe(false); expect(IsoWeekday.create(0).ok).toBe(false); expect(IsoWeekday.create(8).ok).toBe(false);
  });
  test("Frequency owns calendar firing, overlap and primitive round-trip", () => {
    const monday = value(WeekdayFrequency.fromDays([1])); const weeklyMonday = value(EveryNDaysFrequency.fromInterval(7, "2026-03-16")); const tuesday = value(WeekdayFrequency.fromDays([2]));
    expect(monday.firesOn(CalendarDate.rehydrate("2026-03-16"))).toBe(true); expect(monday.sharesADayWith(weeklyMonday)).toBe(true); expect(tuesday.sharesADayWith(weeklyMonday)).toBe(false);
    expect(Frequency.rehydrate(monday.toPrimitives()).equals(monday)).toBe(true); expect(Frequency.rehydrate(weeklyMonday.toPrimitives()).equals(weeklyMonday)).toBe(true);
    expect(EveryNDaysFrequency.fromInterval(0, "2026-03-16").ok).toBe(false); expect(EveryNDaysFrequency.fromInterval(90, "2026-03-16").ok).toBe(true); expect(EveryNDaysFrequency.fromInterval(91, "2026-03-16").ok).toBe(false);
  });
  test("Schedule identity, entry rehydration and ScheduleBook collision rules use domain types", () => {
    const id = uuid(); expect(ScheduleId.rehydrate(id).equals(ScheduleId.rehydrate(id))).toBe(true); expect(ScheduleId.create("bad").ok).toBe(false);
    const raw = { id, time: "06:00", frequency: { kind: "weekdays", days: [1] }, channel: 1, recipe: { mode: "Time", total: 30, preWetPercent: 20, flushMinutes: 5 } };
    const entry = ScheduleEntry.rehydrate(raw); expect(entry.id.toString()).toBe(id); expect(ScheduleEntry.rehydrate(raw).equals(entry)).toBe(true);
    expect(ScheduleBook.rehydrate([]).add(entry).ok).toBe(true);
    const clash = ScheduleEntry.rehydrate({ ...raw, id: uuid(), channel: 2 }); expect(ScheduleBook.rehydrate([entry]).add(clash).ok).toBe(false);
  });
});

describe("watering event value objects", () => {
  test("DeviceId, sequence and litres validate their primitive ranges", () => {
    expect(DeviceId.rehydrate(" controller ").toString()).toBe(" controller "); expect(DeviceId.create(" ").ok).toBe(false);
    for (const n of [0, 0xffff_ffff]) expect(WateringEventSequence.create(n).ok).toBe(true); for (const n of [-1, 1.2, 0x1_0000_0000]) expect(WateringEventSequence.create(n).ok).toBe(false);
    expect(LitresDelivered.create(0).ok).toBe(true); expect(LitresDelivered.create(12.4).ok).toBe(true); expect(LitresDelivered.create(-0.1).ok).toBe(false);
  });
  test("outcome and trigger are closed and equal by value", () => {
    for (const outcome of ["completed", "aborted", "dry_run", "recovery", "skipped"]) expect(WateringOutcome.create(outcome).ok).toBe(true); expect(WateringOutcome.create("failed").ok).toBe(false); expect(WateringOutcome.rehydrate("completed").equals(WateringOutcome.rehydrate("completed"))).toBe(true);
    for (const trigger of ["manual", "sequence", "scheduled"]) expect(WateringTrigger.create(trigger).ok).toBe(true); expect(WateringTrigger.create("timer").ok).toBe(false);
  });
  test("DeviceTimestamp preserves epoch-zero unknown and TimeRange rejects reversed known dates", () => {
    const unknown = value(DeviceTimestamp.fromEpochSeconds(0)); expect(unknown.isKnown()).toBe(false); expect(unknown.toDate()).toBeNull();
    const known = value(DeviceTimestamp.fromEpochSeconds(1_739_112_000)); expect(known.toIsoString()).toBe(new Date(1_739_112_000_000).toISOString()); expect(known.equals(DeviceTimestamp.fromDate(known.toDate()))).toBe(true);
    expect(WateringTimeRange.fromEpochSeconds(10, 20).ok).toBe(true); expect(WateringTimeRange.fromEpochSeconds(20, 10).ok).toBe(false); expect(WateringTimeRange.fromEpochSeconds(-1, 0).ok).toBe(false);
  });
  test("WateringEventId is composite and WateringEvent validates the full device payload", () => {
    const device = DeviceId.rehydrate("kc868-a8"), sequence = WateringEventSequence.rehydrate(0); const id = WateringEventId.of(device, sequence);
    expect(id.toString()).toBe("kc868-a8:0"); expect(id.equals(WateringEventId.of(DeviceId.rehydrate("kc868-a8"), WateringEventSequence.rehydrate(0)))).toBe(true);
    const raw = { deviceId: "kc868-a8", seq: 0, start: 10, end: 20, litres: 3.2, outcome: "completed", trigger: "manual", output: 4 };
    const event = value(WateringEvent.create(raw)); expect(event.id.equals(id)).toBe(true); expect(event.outputChannel?.toNumber()).toBe(4);
    expect(WateringEvent.create({ ...raw, output: 99 }).ok).toBe(false); expect(WateringEvent.create({ ...raw, litres: -1 }).ok).toBe(false); expect(WateringEvent.create({ ...raw, seq: -1 }).ok).toBe(false);
  });
});
