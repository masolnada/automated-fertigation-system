import type { WateringHistory } from "@hort/contracts";
import type { WateringQueryContext } from "./context";
import { wateringEventDto } from "./watering-event-dto";

export function getWateringHistory(ctx: WateringQueryContext, since: Date, until: Date): WateringHistory {
  const history = ctx.wateringEvents.history(since, until);
  return {
    chartEvents: history.chartEvents.map((event) => wateringEventDto(ctx, event)),
    lastWatering: history.lastWatering ? wateringEventDto(ctx, history.lastWatering) : null,
    earliestEventAt: history.earliestEventAt?.toISOString() ?? null,
  };
}
