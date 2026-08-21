import { describe, expect, test } from "bun:test";
import { ScheduleEntry } from "./schedule-entry";

const rawEntry = () => ({
  id: crypto.randomUUID(),
  time: "06:00",
  frequency: { kind: "weekdays" as const, days: [1] },
  channel: 1,
  recipe: { mode: "Time" as const, total: 30, preWetPercent: 20, flushMinutes: 5 },
});

describe("ScheduleEntry", () => {
  test("rehydrates and compares by value", () => {
    const raw = rawEntry();
    const entry = ScheduleEntry.rehydrate(raw);
    expect(entry.id.toString()).toBe(raw.id);
    expect(ScheduleEntry.rehydrate(raw).equals(entry)).toBe(true);
  });
});
