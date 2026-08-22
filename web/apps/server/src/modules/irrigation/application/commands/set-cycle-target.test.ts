import { describe, expect, test } from "bun:test";
import { createIrrigationCommandHarness } from "../command-test-support";
import { setCycleTarget } from "./set-cycle-target";

describe("set-cycle-target", () => {
  test("publishes litres when the current mode is Volume", () => {
    const { ctx, controller, published } = createIrrigationCommandHarness();
    controller.message("kc868-a8", "kc868-a8/select/default_cycle_mode/state", "Volume");
    setCycleTarget(ctx, { value: 200 });
    expect(published).toEqual([{ topic: "kc868-a8/number/default_cycle_liters/command", payload: "200", retain: false }]);
  });

  test("publishes minutes when the current mode is Time", () => {
    const { ctx, published } = createIrrigationCommandHarness();
    setCycleTarget(ctx, { value: 30 });
    expect(published).toEqual([{ topic: "kc868-a8/number/default_cycle_minutes/command", payload: "30", retain: false }]);
  });
});
