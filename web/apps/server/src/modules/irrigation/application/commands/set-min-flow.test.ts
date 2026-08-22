import { describe, expect, test } from "bun:test";
import { createIrrigationCommandHarness } from "../command-test-support";
import { setMinFlow } from "./set-min-flow";

describe("set-min-flow", () => {
  test("publishes the validated minimum flow", () => {
    const { ctx, published } = createIrrigationCommandHarness();
    setMinFlow(ctx, { value: 1.5 });
    expect(published).toEqual([{ topic: "kc868-a8/number/min_flow/command", payload: "1.5", retain: false }]);
  });
});
