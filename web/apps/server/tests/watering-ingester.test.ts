import { beforeEach, describe, expect, test } from "bun:test";
import { WateringIngester } from "../src/application/watering-ingester";
import { openDatabase } from "../src/infrastructure/db/database";
import { DrizzleWateringEventRepository } from "../src/infrastructure/db/watering-repository";
import type { DevicePort } from "../src/domain/ports";

// A device whose watering-log listener we can drive directly.
function fakeDevice(): { device: DevicePort; emit: (payload: string) => void } {
  let listener: (payload: string) => void = () => {};
  const device: DevicePort = {
    prefix: "kc868-a8",
    publish: () => {},
    onResetResult: () => () => {},
    onWateringLog: (cb) => { listener = cb; return () => {}; },
  };
  return { device, emit: (payload) => listener(payload) };
}

const event = (seq: number, extra: Record<string, unknown> = {}) => ({ seq, start: 1_739_112_000, end: 1_739_112_360, litres: 12.4, outcome: "completed", trigger: "sequence", ...extra });
const log = (events: unknown[], device = "kc868-a8") => JSON.stringify({ device, events });

describe("WateringIngester", () => {
  let repo: DrizzleWateringEventRepository;
  let emit: (payload: string) => void;

  beforeEach(() => {
    repo = new DrizzleWateringEventRepository(openDatabase(":memory:"));
    const f = fakeDevice();
    emit = f.emit;
    new WateringIngester(repo, f.device).start();
  });

  test("ingests events and maps device epoch to ISO", () => {
    emit(log([event(1), event(2, { outcome: "recovery", trigger: "manual", channel: "zone-1" })]));
    const rows = repo.recent(10);
    expect(rows).toHaveLength(2);
    const first = rows.find((r) => r.seq === 1)!;
    expect(first.deviceId).toBe("kc868-a8");
    expect(first.startedAt).toBe(new Date(1_739_112_000_000).toISOString());
    expect(first.litresDelivered).toBeCloseTo(12.4, 5);
    const second = rows.find((r) => r.seq === 2)!;
    expect(second.outcome).toBe("recovery");
    expect(second.channel).toBe("zone-1");
  });

  test("dedups by (device, seq) across repeated retained payloads", () => {
    emit(log([event(1), event(2)]));
    emit(log([event(1), event(2), event(3)])); // reconnect: whole log re-sent
    const rows = repo.recent(10);
    expect(rows.map((r) => r.seq).sort()).toEqual([1, 2, 3]);
  });

  test("same seq on a different device is a distinct event", () => {
    emit(log([event(1)], "kc868-a8"));
    emit(log([event(1)], "kc868-b"));
    expect(repo.recent(10)).toHaveLength(2);
  });

  test("stores epoch-0 (device clock not set) as null timestamps", () => {
    emit(log([event(1, { start: 0, end: 0 })]));
    const row = repo.recent(10)[0]!;
    expect(row.startedAt).toBeNull();
    expect(row.endedAt).toBeNull();
    expect(row.litresDelivered).toBeCloseTo(12.4, 5);
  });

  test("skips malformed payloads and invalid events without throwing", () => {
    emit("not json");
    emit(JSON.stringify({ device: "kc868-a8" })); // no events
    emit(log([event(1, { outcome: "bogus" }), { seq: 2 }, event(3)])); // 1 valid (seq 3)
    const rows = repo.recent(10);
    expect(rows.map((r) => r.seq)).toEqual([3]);
  });
});
