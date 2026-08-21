import { describe, expect, test } from "bun:test";
import { TimeOfDay } from "./time-of-day";

describe("TimeOfDay", () => {
  test("strictly parses, formats and compares", () => {
    expect(TimeOfDay.rehydrate("00:00").toString()).toBe("00:00");
    expect(TimeOfDay.rehydrate("23:59").toString()).toBe("23:59");
    expect(TimeOfDay.rehydrate("06:00").compare(TimeOfDay.rehydrate("06:01"))).toBeLessThan(0);
    for (const raw of ["6:00", "24:00", "06:60", "06:00:00"]) expect(TimeOfDay.create(raw).ok).toBe(false);
  });
});
