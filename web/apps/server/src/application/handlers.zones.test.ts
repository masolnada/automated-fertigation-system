import { beforeEach, describe, expect, test } from "bun:test";
import { openDatabase, type Db } from "../infrastructure/db/database";
import { ControllerSnapshotProjection } from "../infrastructure/projections/controller-snapshot-projection";
import { DrizzleScheduleRepository } from "../modules/scheduling/infrastructure/drizzle-schedule-repository";
import { DrizzleWateringEventRepository } from "../modules/watering/infrastructure/drizzle-watering-event-repository";
import { DrizzleZoneRepository } from "../modules/zones/infrastructure/drizzle-zone-repository";
import { SystemClock } from "../shared-kernel/clock";
import { UuidGenerator } from "../shared-kernel/id-generator";
import { dispatchCommand } from "./dispatch";
import { CommandError, type Context } from "./handlers";

describe("zone command handlers", () => {
  let db: Db;
  let zones: DrizzleZoneRepository;
  let controller: ControllerSnapshotProjection;
  let ctx: Context;
  let published: Array<{ topic: string; payload: string }>;

  beforeEach(() => {
    db = openDatabase(":memory:");
    zones = new DrizzleZoneRepository(db);
    controller = new ControllerSnapshotProjection();
    published = [];
    ctx = {
      controller,
      zones,
      wateringEvents: new DrizzleWateringEventRepository(db, zones),
      schedules: new DrizzleScheduleRepository(db),
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
  const snapshot = () => controller.getSnapshot();

  test("publishes zones and assignments into the snapshot", () => {
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    dispatch("set-assignments", { assignments: { 1: zone.id, 2: null, 3: null, 4: null } });
    expect(snapshot().zones.map((value) => value.name)).toEqual(["Olive terrace"]);
    expect(snapshot().assignments).toEqual({ 1: zone.id });
  });

  test("refuses one zone on two channels as a whole", () => {
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    expect(() => dispatch("set-assignments", { assignments: { 1: zone.id, 2: zone.id } })).toThrow(CommandError);
    expect(zones.currentAssignments().toRecord()).toEqual({});
  });

  test("refuses assigning an archived zone", () => {
    const zone = dispatch("create-zone", { name: "Tomato patch" }) as { id: string };
    dispatch("archive-zone", { id: zone.id });
    expect(() => dispatch("set-assignments", { assignments: { 1: zone.id } })).toThrow(CommandError);
  });

  test("refuses assignment edits and archive-induced clearing while the pump runs", () => {
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    dispatch("set-assignments", { assignments: { 1: zone.id } });
    controller.message("kc868-a8", "kc868-a8/switch/pump/state", "ON");
    expect(() => dispatch("set-assignments", { assignments: { 2: zone.id } })).toThrow("Stop the pump to edit assignments");
    expect(() => dispatch("archive-zone", { id: zone.id })).toThrow("Stop the pump to edit assignments");
    expect(zones.currentAssignments().toRecord()).toEqual({ 1: zone.id });
  });

  test("selects one output channel after shutting the others", () => {
    dispatch("select-output", { channel: 2 });
    expect(published).toEqual([
      { topic: "kc868-a8/switch/output_1/command", payload: "OFF" },
      { topic: "kc868-a8/switch/output_3/command", payload: "OFF" },
      { topic: "kc868-a8/switch/output_4/command", payload: "OFF" },
      { topic: "kc868-a8/switch/output_2/command", payload: "ON" },
    ]);
  });

  test("rejects unknown zone ids", () => {
    const id = crypto.randomUUID();
    expect(() => dispatch("rename-zone", { id, name: "X" })).toThrow(CommandError);
    expect(() => dispatch("archive-zone", { id })).toThrow(CommandError);
  });

  test("rejects blank and oversized names", () => {
    expect(() => dispatch("create-zone", { name: "  " })).toThrow(CommandError);
    expect(() => dispatch("create-zone", { name: "x".repeat(41) })).toThrow(CommandError);
  });
});
