import { beforeEach, describe, expect, test } from "bun:test";
import type { DevicePort } from "../../../application/ports/device-port";
import { openDatabase } from "../../../infrastructure/db/database";
import { DrizzleWateringEventRepository } from "../infrastructure/drizzle-watering-event-repository";
import { WateringIngester } from "./watering-ingester";

function fakeDevice(): { device: DevicePort; emit: (payload: string) => void } {
  let listener: (payload: string) => void = () => {};
  const device: DevicePort = {
    prefix: "kc868-a8",
    publish: () => {},
    onResetResult: () => () => {},
    onWateringLog: (callback) => { listener = callback; return () => {}; },
  };
  return { device, emit: (payload) => listener(payload) };
}

const rawEvent = (seq: number, extra: Record<string, unknown> = {}) => ({
  seq,
  start: 1_739_112_000,
  end: 1_739_112_360,
  litres: 12.4,
  outcome: "completed",
  trigger: "sequence",
  output: 1,
  ...extra,
});
const log = (events: unknown[], device = "kc868-a8") => JSON.stringify({ device, events });

describe("WateringIngester", () => {
  let repo: DrizzleWateringEventRepository;
  let emit: (payload: string) => void;

  beforeEach(() => {
    repo = new DrizzleWateringEventRepository(openDatabase(":memory:"));
    const fake = fakeDevice();
    emit = fake.emit;
    new WateringIngester(repo, fake.device).start();
  });

  const recent = () => repo.recent(10).map((stored) => stored.event);

  test("ingests events and maps device epoch to domain timestamps", () => {
    emit(log([rawEvent(1), rawEvent(2, { outcome: "recovery", trigger: "manual", output: 3 })]));
    const rows = recent();
    expect(rows).toHaveLength(2);
    const first = rows.find((row) => row.id.sequence.toNumber() === 1)!;
    expect(first.id.deviceId.toString()).toBe("kc868-a8");
    expect(first.timeRange.startedAt.toIsoString()).toBe(new Date(1_739_112_000_000).toISOString());
    expect(first.litresDelivered.toNumber()).toBeCloseTo(12.4, 5);
    const second = rows.find((row) => row.id.sequence.toNumber() === 2)!;
    expect(second.outcome.toString()).toBe("recovery");
    expect(second.outputChannel?.toNumber()).toBe(3);
  });

  test("stores epoch-0 as an explicit unknown timestamp", () => {
    emit(log([rawEvent(1, { start: 0, end: 0 })]));
    const row = recent()[0]!;
    expect(row.timeRange.startedAt.isKnown()).toBe(false);
    expect(row.timeRange.endedAt.isKnown()).toBe(false);
  });

  test("skips malformed payloads, measurements, channels and ranges", () => {
    emit("not json");
    emit(JSON.stringify({ device: "kc868-a8" }));
    emit(log([
      rawEvent(1, { outcome: "bogus" }),
      rawEvent(2, { litres: -1 }),
      rawEvent(3, { output: 99 }),
      rawEvent(4, { start: 20, end: 10 }),
      rawEvent(5),
    ]));
    expect(recent().map((row) => row.id.sequence.toNumber())).toEqual([5]);
  });
});
