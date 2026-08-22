import { describe, expect, test } from "bun:test";
import { createIrrigationCommandHarness } from "../command-test-support";
import { togglePump } from "./toggle-pump";

describe("toggle-pump", () => {
  test("publishes the pump toggle", () => {
    const { ctx, published } = createIrrigationCommandHarness();
    togglePump(ctx);
    expect(published).toEqual([{ topic: "kc868-a8/switch/pump/command", payload: "TOGGLE", retain: false }]);
  });
});
