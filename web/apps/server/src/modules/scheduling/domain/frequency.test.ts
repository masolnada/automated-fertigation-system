import { describe, expect, test } from "bun:test";
import { CalendarDate } from "./calendar-date";
import { EveryNDaysFrequency, Frequency, WeekdayFrequency } from "./frequency";

const value = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw result.error;
  return result.value;
};

describe("Frequency", () => {
  test("owns calendar firing, overlap and primitive round-trip", () => {
    const monday = value(WeekdayFrequency.fromDays([1]));
    const weeklyMonday = value(EveryNDaysFrequency.fromInterval(7, "2026-03-16"));
    const tuesday = value(WeekdayFrequency.fromDays([2]));
    expect(monday.firesOn(CalendarDate.rehydrate("2026-03-16"))).toBe(true);
    expect(monday.sharesADayWith(weeklyMonday)).toBe(true);
    expect(tuesday.sharesADayWith(weeklyMonday)).toBe(false);
    expect(Frequency.rehydrate(monday.toPrimitives()).equals(monday)).toBe(true);
    expect(Frequency.rehydrate(weeklyMonday.toPrimitives()).equals(weeklyMonday)).toBe(true);
    expect(EveryNDaysFrequency.fromInterval(0, "2026-03-16").ok).toBe(false);
    expect(EveryNDaysFrequency.fromInterval(90, "2026-03-16").ok).toBe(true);
    expect(EveryNDaysFrequency.fromInterval(91, "2026-03-16").ok).toBe(false);
  });
});
