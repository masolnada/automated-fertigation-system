import { describe, expect, test } from "bun:test";
import { WateringEventSequence } from "./watering-event-sequence";

describe("WateringEventSequence", () => {
  test("validates its primitive range", () => {
    for (const n of [0, 0xffff_ffff]) expect(WateringEventSequence.create(n).ok).toBe(true);
    for (const n of [-1, 1.2, 0x1_0000_0000]) expect(WateringEventSequence.create(n).ok).toBe(false);
  });
});
