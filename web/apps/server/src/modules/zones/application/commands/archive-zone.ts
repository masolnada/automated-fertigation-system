import type { CommandBodies } from "@hort/contracts";
import { CommandError, commandBody } from "../../../../application/command";
import { assignIneligibleReason } from "../../../../application/policies";
import { publishSchedules } from "../../../scheduling/application/publish-schedules";
import type { ZoneContext } from "../context";
import { findZone } from "../find-zone";
import { publishZones } from "../publish-zones";

export function archiveZone(ctx: ZoneContext, body: CommandBodies["archive-zone"]): void {
  const zone = findZone(ctx, commandBody(body).id);
  const table = ctx.zones.currentAssignments();
  const channel = table.channelFor(zone.id);
  if (channel) {
    const reason = assignIneligibleReason(ctx.controller.getSnapshot());
    if (reason) throw new CommandError(409, reason);
  }
  ctx.zones.archive(zone.archive(), table.withoutZone(zone.id), ctx.clock.now());
  publishZones(ctx);
  if (channel) {
    ctx.schedules.removeForChannel(channel);
    publishSchedules(ctx);
  }
}
