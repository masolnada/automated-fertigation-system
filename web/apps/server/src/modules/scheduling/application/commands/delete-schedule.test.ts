import { beforeEach, describe, expect, test } from "bun:test";
import { openDatabase, type Db } from "../../../../infrastructure/db/database";
import { ControllerSnapshotProjection } from "../../../../infrastructure/projections/controller-snapshot-projection";
import { DrizzleWateringEventRepository } from "../../../watering/infrastructure/drizzle-watering-event-repository";
import { DrizzleZoneRepository } from "../../../zones/infrastructure/drizzle-zone-repository";
import { SystemClock } from "../../../../shared-kernel/clock";
import { UuidGenerator } from "../../../../shared-kernel/id-generator";
import { dispatchCommand } from "../../../../application/command-dispatcher";
import { CommandError, type Context } from "../../../../application/handlers";
import { DrizzleScheduleRepository } from "../../infrastructure/drizzle-schedule-repository";

const recipe = { mode: "Volume" as const, total: 200, preWetPercent: 20, flushMinutes: 5 };
const entry = { time: "06:00", frequency: { kind: "weekdays" as const, days: [2, 5] }, channel: 1, recipe };

describe("delete-schedule", () => {
  let ctx: Context;
  let published: Array<{ topic: string; payload: string }>;

  beforeEach(() => {
    const db: Db = openDatabase(":memory:");
    const zones = new DrizzleZoneRepository(db);
    published = [];
    ctx = {
      controller: new ControllerSnapshotProjection(),
      zones,
      schedules: new DrizzleScheduleRepository(db),
      wateringEvents: new DrizzleWateringEventRepository(db, zones),
      clock: new SystemClock(),
      ids: new UuidGenerator(),
      device: {
        prefix: "kc868-a8",
        publish: (topic, payload) => { published.push({ topic, payload }); },
        onResetResult: () => () => {},
        onWateringLog: () => () => {},
      },
    };
  });

  const dispatch = (name: string, body: unknown) => dispatchCommand(ctx, name, body);
  const lastSet = () => JSON.parse(published.filter((message) => message.topic.endsWith("/schedule/set")).at(-1)!.payload) as { entries: unknown[] };

  test("removes the entry and publishes the new set", () => {
    const created = dispatch("create-schedule", entry) as { id: string };
    dispatch("delete-schedule", { id: created.id });
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(0);
    expect(lastSet().entries).toHaveLength(0);
  });

  test("treats an unknown id as a no-op", () => {
    dispatch("create-schedule", entry);
    dispatch("delete-schedule", { id: crypto.randomUUID() });
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(1);
  });

  test("refuses a missing id", () => {
    expect(() => dispatch("delete-schedule", {})).toThrow(CommandError);
  });
});
