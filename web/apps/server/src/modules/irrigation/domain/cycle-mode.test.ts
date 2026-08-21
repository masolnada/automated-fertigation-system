import { describe, expect, test } from "bun:test";
import { cycleMode } from "./cycle-mode";

const value = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw result.error;
  return result.value;
};

describe("cycleMode", () => {
  test("is closed", () => {
    expect(value(cycleMode("Time"))).toBe("Time");
    expect(value(cycleMode("Volume"))).toBe("Volume");
    expect(cycleMode("Drip").ok).toBe(false);
  });
});
