import type { CommandBodies } from "@hort/contracts";
import { commandBody, unwrap } from "../../../../application/command";
import { ScheduleId } from "../../domain/schedule-id";
import type { SchedulingContext } from "../context";
import { publishSchedules } from "../publish-schedules";

export function deleteSchedule(ctx: SchedulingContext, body: CommandBodies["delete-schedule"]): void {
  ctx.schedules.remove(unwrap(ScheduleId.create(commandBody(body).id)));
  publishSchedules(ctx);
}
