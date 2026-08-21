import { describe, expect, test } from "bun:test";
import { WateringEvent } from "./watering-event";

const value = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw result.error;
  return result.value;
};

describe("WateringEvent", () => {
  test("validates the full device payload", () => {
    const raw = { deviceId: "kc868-a8", seq: 0, start: 10, end: 20, litres: 3.2, outcome: "completed", trigger: "manual", output: 4 };
    const event = value(WateringEvent.create(raw));
    expect(event.id.toString()).toBe("kc868-a8:0");
    expect(event.outputChannel?.toNumber()).toBe(4);
    expect(WateringEvent.create({ ...raw, output: 99 }).ok).toBe(false);
    expect(WateringEvent.create({ ...raw, litres: -1 }).ok).toBe(false);
    expect(WateringEvent.create({ ...raw, seq: -1 }).ok).toBe(false);
  });
});
