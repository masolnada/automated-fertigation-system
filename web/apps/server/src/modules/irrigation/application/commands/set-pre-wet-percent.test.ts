import { describe, expect, test } from "bun:test";
import { createIrrigationCommandHarness } from "../command-test-support";
import { setPreWetPercent } from "./set-pre-wet-percent";

describe("set-pre-wet-percent", () => {
  test("publishes the validated percentage", () => {
    const { ctx, published } = createIrrigationCommandHarness();
    setPreWetPercent(ctx, { value: 25 });
    expect(published).toEqual([{ topic: "kc868-a8/number/default_pre-wet_percent/command", payload: "25", retain: false }]);
  });
});
