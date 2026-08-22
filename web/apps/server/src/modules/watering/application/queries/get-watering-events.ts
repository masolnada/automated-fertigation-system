import type { WateringEvent } from "@hort/contracts";
import type { WateringQueryContext } from "./context";
import { wateringEventDto } from "./watering-event-dto";

export const getWateringEvents = (ctx: WateringQueryContext): WateringEvent[] =>
  ctx.wateringEvents.recent(100).map((event) => wateringEventDto(ctx, event));
