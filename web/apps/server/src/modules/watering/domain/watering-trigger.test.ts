import { describe, expect, test } from "bun:test";
import { WateringTrigger } from "./watering-trigger";

describe("WateringTrigger", () => {
  test("is closed", () => {
    for (const trigger of ["manual", "sequence", "scheduled"]) expect(WateringTrigger.create(trigger).ok).toBe(true);
    expect(WateringTrigger.create("timer").ok).toBe(false);
  });
});
