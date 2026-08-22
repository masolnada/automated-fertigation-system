import type { CommandBodies, ScheduleEntry as ScheduleEntryDto } from "@hort/contracts";
import { commandBody, unwrap, type Context } from "../../../application/command";
import { topics } from "../../../application/controller-protocol";
import { ScheduleBook } from "../domain/schedule-book";
import { ScheduleEntry } from "../domain/schedule-entry";
import { ScheduleId } from "../domain/schedule-id";

export type SchedulingContext = Pick<Context, "device" | "controller" | "schedules" | "clock" | "ids">;

const scheduleDto = (entry: ScheduleEntry): ScheduleEntryDto => ({
  id: entry.id.toString(),
  time: entry.time.toString(),
  frequency: entry.frequency.toPrimitives(),
  channel: entry.channel.toNumber(),
  recipe: entry.recipe.toPrimitives(),
});

export function publishSchedules(ctx: SchedulingContext): void {
  const entries = ctx.schedules.all();
  ctx.controller.setSchedules(entries.map(scheduleDto));
  ctx.device.publish(topics(ctx.device.prefix).scheduleSet, JSON.stringify({
    entries: entries.map((entry) => {
      const recipe = entry.recipe.toPrimitives();
      const frequency = entry.frequency.toPrimitives();
      return {
        id: entry.id.toString(),
        hour: entry.time.hour,
        minute: entry.time.minute,
        ...(frequency.kind === "weekdays"
          ? { mask: frequency.days.reduce((bits, day) => bits | (1 << (day - 1)), 0), every: 0, from: 0 }
          : { mask: 0, every: frequency.n, from: entry.frequency.anchorEpochDay }),
        channel: entry.channel.toNumber(),
        volume: recipe.mode === "Volume" ? 1 : 0,
        total: recipe.total,
        prewet: recipe.preWetPercent,
        flush: recipe.flushMinutes,
      };
    }),
  }), { retain: true });
}

export const schedulingHandlers = {
  "create-schedule": (ctx: SchedulingContext, body: CommandBodies["create-schedule"]) => {
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
  },
  "delete-schedule": (ctx: SchedulingContext, body: CommandBodies["delete-schedule"]) => {
    ctx.schedules.remove(unwrap(ScheduleId.create(commandBody(body).id)));
    publishSchedules(ctx);
  },
};
