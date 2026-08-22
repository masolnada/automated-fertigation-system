import { describe, expect, test } from "bun:test";
import { ControllerSnapshotProjection } from "../../../infrastructure/projections/controller-snapshot-projection";
import { irrigationHandlers, type IrrigationContext } from "./handlers";

describe("irrigation command handlers", () => {
  test("selects one output channel after shutting the others", () => {
    const published: Array<{ topic: string; payload: string }> = [];
    const ctx: IrrigationContext = {
      controller: new ControllerSnapshotProjection(),
      device: {
        prefix: "kc868-a8",
        publish: (topic, payload) => { published.push({ topic, payload }); },
        onResetResult: () => () => {},
        onWateringLog: () => () => {},
      },
    };

    irrigationHandlers["select-output"](ctx, { channel: 2 });

    expect(published).toEqual([
      { topic: "kc868-a8/switch/output_1/command", payload: "OFF" },
      { topic: "kc868-a8/switch/output_3/command", payload: "OFF" },
      { topic: "kc868-a8/switch/output_4/command", payload: "OFF" },
      { topic: "kc868-a8/switch/output_2/command", payload: "ON" },
    ]);
  });
});
