import type { CommandBodies } from "@hort/contracts";
import { commandBody, unwrap } from "../../../../application/command";
import { Zone } from "../../domain/zone";
import { ZoneId } from "../../domain/zone-id";
import { ZoneName } from "../../domain/zone-name";
import type { ZoneContext } from "../context";
import { publishZones } from "../publish-zones";
import { zoneDto } from "../zone-dto";

export function createZone(ctx: ZoneContext, body: CommandBodies["create-zone"]) {
  const zone = Zone.create(
    unwrap(ZoneId.create(ctx.ids.next())),
    unwrap(ZoneName.create(commandBody(body).name)),
  );
  ctx.zones.add(zone, ctx.clock.now());
  publishZones(ctx);
  return zoneDto(zone);
}
