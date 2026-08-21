import { describe, expect, test } from "bun:test";
import { WeekdaySet } from "./weekday-set";

describe("WeekdaySet", () => {
  test("normalizes, compares and encodes a mask", () => {
    const days = WeekdaySet.rehydrate([5, 2, 5]);
    expect(days.toNumbers()).toEqual([2, 5]);
    expect(days.toBitMask()).toBe((1 << 1) | (1 << 4));
    expect(days.equals(WeekdaySet.rehydrate([2, 5]))).toBe(true);
    expect(WeekdaySet.create([]).ok).toBe(false);
  });
});
