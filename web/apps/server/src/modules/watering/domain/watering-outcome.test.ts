import { describe, expect, test } from "bun:test";
import { WateringOutcome } from "./watering-outcome";

describe("WateringOutcome", () => {
  test("is closed and equal by value", () => {
    for (const outcome of ["completed", "aborted", "dry_run", "recovery", "skipped"]) expect(WateringOutcome.create(outcome).ok).toBe(true);
    expect(WateringOutcome.create("failed").ok).toBe(false);
    expect(WateringOutcome.rehydrate("completed").equals(WateringOutcome.rehydrate("completed"))).toBe(true);
  });
});
