import { describe, expect, test } from "bun:test";
import { createIrrigationCommandHarness } from "../command-test-support";
import { stopIrrigation } from "./stop-irrigation";

describe("stop-irrigation", () => {
  test("publishes the stop command", () => {
    const { ctx, published } = createIrrigationCommandHarness();
    stopIrrigation(ctx);
    expect(published).toEqual([{ topic: "kc868-a8/irrigation/stop", payload: "ON", retain: false }]);
  });
});
