import { describe, expect, test } from "bun:test";
import { OutputChannel } from "./output-channel";

describe("OutputChannel", () => {
  test("accepts only 1-4 and round-trips by value", () => {
    for (const n of [1, 2, 3, 4] as const) expect(OutputChannel.rehydrate(n).toNumber()).toBe(n);
    for (const n of [0, 5, 1.5, "1"]) expect(OutputChannel.create(n).ok).toBe(false);
    expect(OutputChannel.rehydrate(2).equals(OutputChannel.rehydrate(2))).toBe(true);
  });
});
