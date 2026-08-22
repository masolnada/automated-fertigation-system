import type { WateringEvent as WateringEventDto } from "@hort/contracts";
import type { StoredWateringEvent } from "../watering-event-repository";
import type { WateringQueryContext } from "./context";

export function wateringEventDto(ctx: WateringQueryContext, stored: StoredWateringEvent): WateringEventDto {
  const { event } = stored;
  const zoneId = event.outputChannel
    ? ctx.zones.zoneAt(event.outputChannel, event.timeRange.endedAt.toDate())
    : null;
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
