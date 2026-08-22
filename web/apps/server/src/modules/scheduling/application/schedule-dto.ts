import type { ScheduleEntry as ScheduleEntryDto } from "@hort/contracts";
import type { ScheduleEntry } from "../domain/schedule-entry";

export const scheduleDto = (entry: ScheduleEntry): ScheduleEntryDto => ({
  id: entry.id.toString(),
  time: entry.time.toString(),
  frequency: entry.frequency.toPrimitives(),
  channel: entry.channel.toNumber(),
  recipe: entry.recipe.toPrimitives(),
});
