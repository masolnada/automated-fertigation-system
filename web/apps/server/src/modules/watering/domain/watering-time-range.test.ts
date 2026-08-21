import { describe, expect, test } from "bun:test";
import { WateringTimeRange } from "./watering-time-range";

describe("WateringTimeRange", () => {
  test("rejects reversed known dates", () => {
    expect(WateringTimeRange.fromEpochSeconds(10, 20).ok).toBe(true);
    expect(WateringTimeRange.fromEpochSeconds(20, 10).ok).toBe(false);
    expect(WateringTimeRange.fromEpochSeconds(-1, 0).ok).toBe(false);
  });
});
