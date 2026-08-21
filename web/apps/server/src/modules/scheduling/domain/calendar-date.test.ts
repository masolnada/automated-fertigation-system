import { describe, expect, test } from "bun:test";
import { CalendarDate } from "./calendar-date";

describe("CalendarDate", () => {
  test("rejects impossible dates and round-trips epoch days", () => {
    for (const raw of ["2024-02-29", "2026-01-01", "2026-12-31"]) {
      const date = CalendarDate.rehydrate(raw);
      expect(CalendarDate.fromEpochDay(date.toEpochDay()).equals(date)).toBe(true);
      expect(date.toString()).toBe(raw);
    }
    for (const raw of ["2026-02-29", "2026-02-31", "2026-13-01", "14-03-2026"]) expect(CalendarDate.create(raw).ok).toBe(false);
  });
});
