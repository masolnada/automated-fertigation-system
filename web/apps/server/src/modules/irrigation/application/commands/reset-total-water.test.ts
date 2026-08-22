import { describe, expect, test } from "bun:test";
import { createIrrigationCommandHarness } from "../command-test-support";
import { resetTotalWater } from "./reset-total-water";

describe("reset-total-water", () => {
  test("publishes a non-retained request and returns the device result", async () => {
    const { ctx, makeResetEligible, published, respondToReset } = createIrrigationCommandHarness();
    makeResetEligible();
    const outcome = resetTotalWater(ctx);
    expect(published.at(-1)).toEqual({ topic: "kc868-a8/flow/reset_total/request", payload: "ON", retain: false });
    respondToReset("success");
    expect(await outcome).toEqual({ result: "success" });
  });
});
