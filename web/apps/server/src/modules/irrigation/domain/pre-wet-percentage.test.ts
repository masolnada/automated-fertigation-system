import { describe, expect, test } from "bun:test";
import { PreWetPercentage } from "./pre-wet-percentage";

describe("PreWetPercentage", () => {
  test("enforces machine limits", () => {
    for (const n of [0, 100]) expect(PreWetPercentage.create(n).ok).toBe(true);
    for (const n of [-1, 101, Number.NaN]) expect(PreWetPercentage.create(n).ok).toBe(false);
  });
});
