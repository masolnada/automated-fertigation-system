import { topics } from "../../../application/controller-protocol";
import type { SchedulingContext } from "./context";
import { scheduleDto } from "./schedule-dto";

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
