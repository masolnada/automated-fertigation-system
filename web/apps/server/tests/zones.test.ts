import { beforeEach, describe, expect, test } from "bun:test";
import { Controller } from "../src/domain/controller";
import { openDatabase } from "../src/infrastructure/db/database";
import { DrizzleWateringEventRepository } from "../src/infrastructure/db/watering-repository";
import { DrizzleZoneNameRepository } from "../src/infrastructure/db/zone-name-repository";
import { dispatchCommand } from "../src/application/dispatch";
import { CommandError, type Context } from "../src/application/handlers";

function context() {
  const published: Array<{ topic: string; payload: string }> = [];
  const db = openDatabase(":memory:");
  const zoneNames = new DrizzleZoneNameRepository(db);
  const wateringEvents = new DrizzleWateringEventRepository(db, zoneNames);
  const controller = new Controller();
  const device = {
    prefix: "kc868-a8",
    publish: (topic: string, payload: string) => { published.push({ topic, payload }); },
    onResetResult: () => () => {},
    onWateringLog: () => () => {},
  };
  const ctx: Context = { device, controller, wateringEvents, zoneNames };
  return { ctx, published, zoneNames, wateringEvents, controller };
}

describe("zone selection", () => {
  test("opens the chosen zone and shuts the others", () => {
    const { ctx, published } = context();
    dispatchCommand(ctx, "select-zone", { zone: 3 });
    expect(published.filter((p) => p.payload === "OFF").map((p) => p.topic)).toEqual([
      "kc868-a8/switch/zone_1/command",
      "kc868-a8/switch/zone_2/command",
      "kc868-a8/switch/zone_4/command",
    ]);
    expect(published.at(-1)).toEqual({ topic: "kc868-a8/switch/zone_3/command", payload: "ON" });
  });

  test("zone 0 shuts every zone and opens none", () => {
    const { ctx, published } = context();
    dispatchCommand(ctx, "select-zone", { zone: 0 });
    expect(published).toHaveLength(4);
    expect(published.every((p) => p.payload === "OFF")).toBe(true);
  });

  test("rejects a zone outside the relay map", () => {
    const { ctx } = context();
    expect(() => dispatchCommand(ctx, "select-zone", { zone: 5 })).toThrow(CommandError);
  });

  test("one source open at a time", () => {
    const { ctx, published } = context();
    dispatchCommand(ctx, "select-valve", { valve: "microbiology_valve" });
    expect(published.at(-1)).toEqual({ topic: "kc868-a8/switch/microbiology_valve/command", payload: "ON" });
    expect(published.filter((p) => p.payload === "OFF")).toHaveLength(2);
  });
});

describe("zone names", () => {
  test("rename is stored and surfaced on the snapshot", () => {
    const { ctx, controller } = context();
    dispatchCommand(ctx, "set-zone-name", { zone: 2, name: "Almond row" });
    expect(controller.getSnapshot().zoneNames[2]).toBe("Almond row");
  });

  test("rejects empty and over-long names", () => {
    const { ctx } = context();
    expect(() => dispatchCommand(ctx, "set-zone-name", { zone: 2, name: "   " })).toThrow(CommandError);
    expect(() => dispatchCommand(ctx, "set-zone-name", { zone: 2, name: "x".repeat(41) })).toThrow(CommandError);
  });

  // The reason the table is temporal at all (web ADR-0010): the controller is
  // offline for weeks, so events are ingested long after they ran.
  test("history keeps the name in force when each event ran", () => {
    const { zoneNames, wateringEvents } = context();
    const early = new Date("2026-05-01T10:00:00Z");
    const late = new Date("2026-06-01T10:00:00Z");
    zoneNames.rename(1, "Olive terrace", new Date("2026-04-01T00:00:00Z"));

    wateringEvents.ingest([{ deviceId: "kc868-a8", seq: 1, startedAt: early, endedAt: early, litresDelivered: 10, outcome: "completed", trigger: "sequence", zone: 1 }]);
    zoneNames.rename(1, "Almond row", new Date("2026-05-15T00:00:00Z"));
    wateringEvents.ingest([{ deviceId: "kc868-a8", seq: 2, startedAt: late, endedAt: late, litresDelivered: 12, outcome: "completed", trigger: "sequence", zone: 1 }]);

    const rows = wateringEvents.recent(10);
    expect(rows.find((r) => r.seq === 1)!.zoneName).toBe("Olive terrace");
    expect(rows.find((r) => r.seq === 2)!.zoneName).toBe("Almond row");
    expect(zoneNames.current()[1]).toBe("Almond row");
  });

  test("an event with no clock falls back to the earliest known name", () => {
    const { zoneNames, wateringEvents } = context();
    zoneNames.rename(1, "Olive terrace", new Date("2026-04-01T00:00:00Z"));
    zoneNames.rename(1, "Almond row", new Date("2026-05-15T00:00:00Z"));
    wateringEvents.ingest([{ deviceId: "kc868-a8", seq: 9, startedAt: null, endedAt: null, litresDelivered: 5, outcome: "completed", trigger: "manual", zone: 1 }]);
    expect(wateringEvents.recent(10).find((r) => r.seq === 9)!.zoneName).toBe("Olive terrace");
  });
});
