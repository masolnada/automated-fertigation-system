import { describe, expect, test } from "bun:test";
import { ScheduleBook } from "./schedule-book";
import { ScheduleEntry } from "./schedule-entry";

const entry = (partial: Record<string, unknown> = {}) => ScheduleEntry.rehydrate({
  id: crypto.randomUUID(),
  time: "06:00",
  frequency: { kind: "weekdays", days: [1] },
  channel: 1,
  recipe: { mode: "Time", total: 30, preWetPercent: 20, flushMinutes: 5 },
  ...partial,
});

describe("ScheduleBook", () => {
  test("owns collision rules", () => {
    const first = entry();
    expect(ScheduleBook.rehydrate([]).add(first).ok).toBe(true);
    expect(ScheduleBook.rehydrate([first]).add(entry({ channel: 2 })).ok).toBe(false);
  });
});
