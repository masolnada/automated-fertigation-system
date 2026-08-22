import { describe, expect, test } from "bun:test";
import { createIrrigationCommandHarness } from "../command-test-support";
import { setCycleMode } from "./set-cycle-mode";

describe("set-cycle-mode", () => {
  test("publishes the selected default mode", () => {
    const { ctx, published } = createIrrigationCommandHarness();
    setCycleMode(ctx, { mode: "Volume" });
    expect(published).toEqual([{ topic: "kc868-a8/select/default_cycle_mode/command", payload: "Volume", retain: false }]);
  });
});
