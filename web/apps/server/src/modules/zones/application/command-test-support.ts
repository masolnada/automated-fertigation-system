import { openDatabase } from "../../../infrastructure/db/database";
import { ControllerSnapshotProjection } from "../../../infrastructure/projections/controller-snapshot-projection";
import { DrizzleScheduleRepository } from "../../scheduling/infrastructure/drizzle-schedule-repository";
import { DrizzleWateringEventRepository } from "../../watering/infrastructure/drizzle-watering-event-repository";
import { SystemClock } from "../../../shared-kernel/clock";
import { UuidGenerator } from "../../../shared-kernel/id-generator";
import { dispatchCommand } from "../../../application/command-dispatcher";
import type { Context } from "../../../application/handlers";
import { DrizzleZoneRepository } from "../infrastructure/drizzle-zone-repository";

export function createZoneCommandHarness() {
  const db = openDatabase(":memory:");
  const zones = new DrizzleZoneRepository(db);
  const controller = new ControllerSnapshotProjection();
  const published: Array<{ topic: string; payload: string }> = [];
  const ctx: Context = {
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
  return {
    ctx,
    zones,
    controller,
    published,
    dispatch: (name: string, body: unknown) => dispatchCommand(ctx, name, body),
  };
}
