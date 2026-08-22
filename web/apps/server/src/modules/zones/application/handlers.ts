import type { CommandBodies, Zone as ZoneDto } from "@hort/contracts";
import { CommandError, commandBody, unwrap, type Context } from "../../../application/command";
import { assignIneligibleReason } from "../../../application/policies";
import { publishSchedules } from "../../scheduling/application/handlers";
import { AssignmentTable } from "../domain/assignment-table";
import { Zone } from "../domain/zone";
import { ZoneId } from "../domain/zone-id";
import { ZoneName } from "../domain/zone-name";

export type ZoneContext = Pick<Context, "device" | "controller" | "zones" | "schedules" | "clock" | "ids">;

const zoneDto = (zone: Zone): ZoneDto => ({
  id: zone.id.toString(),
  name: zone.name.toString(),
  archived: zone.archived,
});

function publishZones(ctx: ZoneContext): void {
  ctx.controller.setZones(ctx.zones.all().map(zoneDto), ctx.zones.currentAssignments().toRecord());
}

function findZone(ctx: ZoneContext, raw: unknown): Zone {
  const id = unwrap(ZoneId.create(raw));
  const zone = ctx.zones.find(id);
  if (!zone) throw new CommandError(404, "unknown zone");
  return zone;
}

export const zoneHandlers = {
  "create-zone": (ctx: ZoneContext, body: CommandBodies["create-zone"]) => {
    const zone = Zone.create(
      unwrap(ZoneId.create(ctx.ids.next())),
      unwrap(ZoneName.create(commandBody(body).name)),
    );
    ctx.zones.add(zone, ctx.clock.now());
    publishZones(ctx);
    return zoneDto(zone);
  },
  "rename-zone": (ctx: ZoneContext, body: CommandBodies["rename-zone"]) => {
    const raw = commandBody(body);
    const zone = findZone(ctx, raw.id).rename(unwrap(ZoneName.create(raw.name)));
    ctx.zones.save(zone);
    publishZones(ctx);
  },
  "archive-zone": (ctx: ZoneContext, body: CommandBodies["archive-zone"]) => {
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
  },
  "unarchive-zone": (ctx: ZoneContext, body: CommandBodies["unarchive-zone"]) => {
    const zone = findZone(ctx, commandBody(body).id).unarchive();
    ctx.zones.save(zone);
    publishZones(ctx);
  },
  "set-assignments": (ctx: ZoneContext, body: CommandBodies["set-assignments"]) => {
    const reason = assignIneligibleReason(ctx.controller.getSnapshot());
    if (reason) throw new CommandError(409, reason);
    const live = ctx.zones.all().filter((zone) => !zone.archived).map((zone) => zone.id);
    const table = unwrap(AssignmentTable.create(commandBody(body).assignments, live));
    ctx.zones.setAssignments(table, ctx.clock.now());
    publishZones(ctx);
  },
};
