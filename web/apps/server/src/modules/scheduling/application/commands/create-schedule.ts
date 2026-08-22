import type { CommandBodies } from "@hort/contracts";
import { commandBody, unwrap } from "../../../../application/command";
import { ScheduleBook } from "../../domain/schedule-book";
import { ScheduleEntry } from "../../domain/schedule-entry";
import type { SchedulingContext } from "../context";
import { publishSchedules } from "../publish-schedules";
import { scheduleDto } from "../schedule-dto";

export function createSchedule(ctx: SchedulingContext, body: CommandBodies["create-schedule"]) {
  const raw = commandBody(body);
  const entry = unwrap(ScheduleEntry.create({
    id: ctx.ids.next(),
    time: raw.time,
    frequency: raw.frequency,
    channel: raw.channel,
    recipe: raw.recipe,
  }));
  unwrap(ScheduleBook.rehydrate(ctx.schedules.all()).add(entry), 409);
  ctx.schedules.save(entry, ctx.clock.now());
  publishSchedules(ctx);
  return scheduleDto(entry);
}
