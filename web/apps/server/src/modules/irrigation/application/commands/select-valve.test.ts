import { describe, expect, test } from "bun:test";
import { CommandError } from "../../../../application/handlers";
import { createIrrigationCommandHarness } from "../command-test-support";
import { selectValve } from "./select-valve";

describe("select-valve", () => {
  test("closes the other sources before opening the selected valve", () => {
    const { ctx, published } = createIrrigationCommandHarness();
    selectValve(ctx, { valve: "fertigation_valve" });
    expect(published.map(({ topic, payload }) => ({ topic, payload }))).toEqual([
      { topic: "kc868-a8/switch/clean_water_valve/command", payload: "OFF" },
      { topic: "kc868-a8/switch/microbiology_valve/command", payload: "OFF" },
      { topic: "kc868-a8/switch/fertigation_valve/command", payload: "ON" },
    ]);
  });

  test("rejects an unknown valve", () => {
    const { ctx } = createIrrigationCommandHarness();
    expect(() => selectValve(ctx, { valve: "unknown" as never })).toThrow(CommandError);
  });
});
