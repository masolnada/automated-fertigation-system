import { beforeEach, describe, expect, test } from "bun:test";
import { openDatabase } from "../../../infrastructure/db/database";
import { WateringEvent } from "../domain/watering-event";
import { DrizzleWateringEventRepository } from "./drizzle-watering-event-repository";

const event = (seq: number, partial: Record<string, unknown> = {}) => WateringEvent.rehydrate({
  deviceId: "kc868-a8",
  seq,
  startedAt: new Date(1_739_112_000_000),
  endedAt: new Date(1_739_112_360_000),
  litresDelivered: 12.4,
  outcome: "completed",
  trigger: "sequence",
  outputChannel: 1,
  ...partial,
});

describe("DrizzleWateringEventRepository", () => {
  let repo: DrizzleWateringEventRepository;

  beforeEach(() => {
    repo = new DrizzleWateringEventRepository(openDatabase(":memory:"));
  });

  test("deduplicates by device and sequence", () => {
    repo.ingest([event(1), event(2)]);
    repo.ingest([event(1), event(2), event(3)]);
    expect(repo.recent(10).map((row) => row.event.id.sequence.toNumber()).sort()).toEqual([1, 2, 3]);
  });

  test("treats the same sequence on another device as distinct", () => {
    repo.ingest([event(1), event(1, { deviceId: "kc868-b" })]);
    expect(repo.recent(10)).toHaveLength(2);
  });

  test("builds ranged history in controller order", () => {
    repo.ingest([
      event(8, { startedAt: new Date(1_739_112_500_000), endedAt: new Date(1_739_112_600_000), litresDelivered: 0, outcome: "dry_run" }),
      event(9, { startedAt: null, endedAt: null, litresDelivered: 4.2, outcome: "aborted" }),
      event(7),
    ]);
    const history = repo.history(new Date(1_739_111_000_000), new Date(1_739_113_000_000));
    expect(history.chartEvents.map((row) => row.event.id.sequence.toNumber())).toEqual([7, 8]);
    expect(repo.recent(2).map((row) => row.event.id.sequence.toNumber())).toEqual([9, 8]);
    expect(history.lastWatering?.event.id.sequence.toNumber()).toBe(9);
    expect(history.lastWatering?.event.timeRange.endedAt.isKnown()).toBe(false);
    expect(history.earliestEventAt?.toISOString()).toBe(new Date(1_739_112_360_000).toISOString());
    expect(repo.history(new Date(1_739_111_000_000), new Date(1_739_112_600_000)).chartEvents.map((row) => row.event.id.sequence.toNumber())).toEqual([7]);
  });

  test("does not truncate the requested chart range", () => {
    repo.ingest(Array.from({ length: 105 }, (_, index) => event(index + 1, {
      startedAt: new Date((1_739_112_000 + index * 60) * 1000),
      endedAt: new Date((1_739_112_030 + index * 60) * 1000),
    })));
    expect(repo.history(new Date(1_739_111_000_000), new Date(1_739_120_000_000)).chartEvents).toHaveLength(105);
  });
});
