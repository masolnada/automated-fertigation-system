import { describe, expect, test } from "bun:test";
import { CalendarDate } from "./calendar-date";
import { IsoWeekday } from "./iso-weekday";

describe("IsoWeekday", () => {
  test("derives weekdays and validates the ISO range", () => {
    expect(IsoWeekday.fromEpochDay(CalendarDate.rehydrate("2026-03-16").toEpochDay()).toNumber()).toBe(1);
    expect(IsoWeekday.create(0).ok).toBe(false);
    expect(IsoWeekday.create(8).ok).toBe(false);
  });
});
