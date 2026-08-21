import { describe, expect, test } from "bun:test";
import { CycleTarget } from "./cycle-target";

describe("CycleTarget", () => {
  test("is mode-aware at every boundary", () => {
    for (const [mode, valid, invalid] of [["Time", [0, 180], [-1, 181]], ["Volume", [0, 500], [-1, 501]]] as const) {
      for (const n of valid) expect(CycleTarget.create(mode, n).ok).toBe(true);
      for (const n of invalid) expect(CycleTarget.create(mode, n).ok).toBe(false);
    }
    expect(CycleTarget.rehydrate("Time", 30).equals(CycleTarget.rehydrate("Time", 30))).toBe(true);
  });
});
