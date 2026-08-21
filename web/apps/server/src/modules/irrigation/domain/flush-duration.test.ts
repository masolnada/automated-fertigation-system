import { describe, expect, test } from "bun:test";
import { FlushDuration } from "./flush-duration";

describe("FlushDuration", () => {
  test("enforces machine limits and compares by value", () => {
    for (const n of [1, 60]) expect(FlushDuration.create(n).ok).toBe(true);
    for (const n of [0, 61]) expect(FlushDuration.create(n).ok).toBe(false);
    expect(FlushDuration.rehydrate(5).equals(FlushDuration.rehydrate(5))).toBe(true);
  });
});
