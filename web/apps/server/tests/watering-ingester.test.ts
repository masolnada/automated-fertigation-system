import { beforeEach, describe, expect, test } from "bun:test";
import { WateringIngester } from "../src/modules/watering/application/watering-ingester";
import { openDatabase } from "../src/infrastructure/db/database";
import { DrizzleWateringEventRepository } from "../src/modules/watering/infrastructure/drizzle-watering-event-repository";
import type { DevicePort } from "../src/application/ports/device-port";

function fakeDevice(): { device: DevicePort; emit: (payload: string) => void } {
  let listener: (payload: string) => void = () => {};
  const device: DevicePort = { prefix: "kc868-a8", publish: () => {}, onResetResult: () => () => {}, onWateringLog: (cb) => { listener = cb; return () => {}; } };
  return { device, emit: (payload) => listener(payload) };
}
const rawEvent = (seq: number, extra: Record<string, unknown> = {}) => ({ seq, start: 1_739_112_000, end: 1_739_112_360, litres: 12.4, outcome: "completed", trigger: "sequence", output: 1, ...extra });
const log = (events: unknown[], device = "kc868-a8") => JSON.stringify({ device, events });

describe("WateringIngester", () => {
  let repo: DrizzleWateringEventRepository; let emit: (payload: string) => void;
  beforeEach(() => { repo = new DrizzleWateringEventRepository(openDatabase(":memory:")); const fake = fakeDevice(); emit = fake.emit; new WateringIngester(repo, fake.device).start(); });
  const recent = (limit = 10) => repo.recent(limit).map((stored) => stored.event);

  test("ingests events and maps device epoch to domain timestamps", () => {
    emit(log([rawEvent(1), rawEvent(2, { outcome: "recovery", trigger: "manual", output: 3 })]));
    const rows = recent(); expect(rows).toHaveLength(2);
    const first = rows.find((row) => row.id.sequence.toNumber() === 1)!;
    expect(first.id.deviceId.toString()).toBe("kc868-a8"); expect(first.timeRange.startedAt.toIsoString()).toBe(new Date(1_739_112_000_000).toISOString()); expect(first.litresDelivered.toNumber()).toBeCloseTo(12.4, 5);
    const second = rows.find((row) => row.id.sequence.toNumber() === 2)!; expect(second.outcome.toString()).toBe("recovery"); expect(second.outputChannel?.toNumber()).toBe(3);
  });
  test("dedups by (device, seq) across repeated retained payloads", () => { emit(log([rawEvent(1), rawEvent(2)])); emit(log([rawEvent(1), rawEvent(2), rawEvent(3)])); expect(recent().map((row) => row.id.sequence.toNumber()).sort()).toEqual([1, 2, 3]); });
  test("same seq on a different device is a distinct event", () => { emit(log([rawEvent(1)], "kc868-a8")); emit(log([rawEvent(1)], "kc868-b")); expect(recent()).toHaveLength(2); });
  test("stores epoch-0 as an explicit unknown timestamp", () => { emit(log([rawEvent(1, { start: 0, end: 0 })])); const row = recent()[0]!; expect(row.timeRange.startedAt.isKnown()).toBe(false); expect(row.timeRange.endedAt.isKnown()).toBe(false); });
  test("builds the ranged chart and Last watering in controller order", () => {
    emit(log([rawEvent(8, { start: 1_739_112_500, end: 1_739_112_600, litres: 0, outcome: "dry_run" }), rawEvent(9, { start: 0, end: 0, litres: 4.2, outcome: "aborted" }), rawEvent(7)]));
    const history = repo.history(new Date(1_739_111_000_000), new Date(1_739_113_000_000));
    expect(history.chartEvents.map((row) => row.event.id.sequence.toNumber())).toEqual([7, 8]); expect(recent(2).map((row) => row.id.sequence.toNumber())).toEqual([9, 8]); expect(history.lastWatering?.event.id.sequence.toNumber()).toBe(9); expect(history.lastWatering?.event.timeRange.endedAt.isKnown()).toBe(false); expect(history.earliestEventAt?.toISOString()).toBe(new Date(1_739_112_360_000).toISOString());
    expect(repo.history(new Date(1_739_111_000_000), new Date(1_739_112_600_000)).chartEvents.map((row) => row.event.id.sequence.toNumber())).toEqual([7]);
  });
  test("does not truncate the requested chart range", () => { emit(log(Array.from({ length: 105 }, (_, index) => rawEvent(index + 1, { start: 1_739_112_000 + index * 60, end: 1_739_112_030 + index * 60 })))); expect(repo.history(new Date(1_739_111_000_000), new Date(1_739_120_000_000)).chartEvents).toHaveLength(105); });
  test("skips malformed payloads, negative measurements, invalid channels and impossible ranges", () => {
    emit("not json"); emit(JSON.stringify({ device: "kc868-a8" })); emit(log([rawEvent(1, { outcome: "bogus" }), rawEvent(2, { litres: -1 }), rawEvent(3, { output: 99 }), rawEvent(4, { start: 20, end: 10 }), rawEvent(5)]));
    expect(recent().map((row) => row.id.sequence.toNumber())).toEqual([5]);
  });
});
