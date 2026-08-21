import { describe, expect, test } from "bun:test";
import { DeviceId } from "./device-id";
import { WateringEventId } from "./watering-event-id";
import { WateringEventSequence } from "./watering-event-sequence";

describe("WateringEventId", () => {
  test("is a composite identity", () => {
    const device = DeviceId.rehydrate("kc868-a8");
    const sequence = WateringEventSequence.rehydrate(0);
    const id = WateringEventId.of(device, sequence);
    expect(id.toString()).toBe("kc868-a8:0");
    expect(id.equals(WateringEventId.of(DeviceId.rehydrate("kc868-a8"), WateringEventSequence.rehydrate(0)))).toBe(true);
  });
});
