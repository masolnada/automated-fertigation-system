import { describe, expect, test } from "bun:test";
import { ScheduleId } from "./schedule-id";

describe("ScheduleId", () => {
  test("validates UUID identity", () => {
    const id = crypto.randomUUID();
    expect(ScheduleId.rehydrate(id).equals(ScheduleId.rehydrate(id))).toBe(true);
    expect(ScheduleId.create("bad").ok).toBe(false);
  });
});
