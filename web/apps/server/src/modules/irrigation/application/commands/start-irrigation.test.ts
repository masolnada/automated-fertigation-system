import { describe, expect, test } from "bun:test";
import { createIrrigationCommandHarness } from "../command-test-support";
import { startIrrigation } from "./start-irrigation";

describe("start-irrigation", () => {
  test("publishes the output channel and recipe together", () => {
    const { ctx, published } = createIrrigationCommandHarness();
    startIrrigation(ctx, { channel: 3, recipe: { mode: "Volume", total: 200, preWetPercent: 20, flushMinutes: 5 } });
    expect(published).toEqual([{
      topic: "kc868-a8/irrigation/start",
      payload: JSON.stringify({ channel: 3, volume: 1, total: 200, prewet: 20, flush: 5 }),
      retain: false,
    }]);
  });
});
