import { describe, expect, test } from "bun:test";
import { createIrrigationCommandHarness } from "../command-test-support";
import { setFlushDuration } from "./set-flush-duration";

describe("set-flush-duration", () => {
  test("publishes the validated duration", () => {
    const { ctx, published } = createIrrigationCommandHarness();
    setFlushDuration(ctx, { value: 7 });
    expect(published).toEqual([{ topic: "kc868-a8/number/default_flush_minutes/command", payload: "7", retain: false }]);
  });
});
