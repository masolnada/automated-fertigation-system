import type { CommandName, WateringEvent as WateringEventDto, WateringHistory } from "@hort/contracts";
import type { StoredWateringEvent } from "../modules/watering/application/watering-event-repository";
import { CommandError, handlers, type Context } from "./handlers";

export function dispatchCommand(ctx: Context, name: string, body: unknown): unknown {
  const handler = (handlers as Record<string, (ctx: Context, body: unknown) => unknown>)[name];
  if (!handler) throw new CommandError(404, `unknown command: ${name}`);
  return handler(ctx, body);
}
export const isCommandName = (name: string): name is CommandName => name in handlers;
export const getSnapshot = (ctx: Context) => ctx.controller.getSnapshot();

function wateringDto(ctx: Context, stored: StoredWateringEvent): WateringEventDto {
  const { event } = stored;
  const zoneId = event.outputChannel ? ctx.zones.zoneAt(event.outputChannel, event.timeRange.endedAt.toDate()) : null;
  return {
    id: stored.rowId,
    deviceId: event.id.deviceId.toString(),
    seq: event.id.sequence.toNumber(),
    startedAt: event.timeRange.startedAt.toIsoString(),
    endedAt: event.timeRange.endedAt.toIsoString(),
    litresDelivered: event.litresDelivered.toNumber(),
    outcome: event.outcome.toString(),
    trigger: event.trigger.toString(),
    outputChannel: event.outputChannel?.toNumber() ?? null,
    zoneId: zoneId?.toString() ?? null,
    zoneName: zoneId ? ctx.zones.nameOf(zoneId)?.toString() ?? null : null,
  };
}

export const getWateringEvents = (ctx: Context): WateringEventDto[] => ctx.wateringEvents.recent(100).map((event) => wateringDto(ctx, event));
export const getWateringHistory = (ctx: Context, since: Date, until: Date): WateringHistory => {
  const history = ctx.wateringEvents.history(since, until);
  return { chartEvents: history.chartEvents.map((event) => wateringDto(ctx, event)), lastWatering: history.lastWatering ? wateringDto(ctx, history.lastWatering) : null, earliestEventAt: history.earliestEventAt?.toISOString() ?? null };
};
