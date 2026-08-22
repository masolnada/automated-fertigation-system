import type { CommandBodies } from "@hort/contracts";
import { commandBody } from "../../../../application/command";
import type { ZoneContext } from "../context";
import { findZone } from "../find-zone";
import { publishZones } from "../publish-zones";

export function unarchiveZone(ctx: ZoneContext, body: CommandBodies["unarchive-zone"]): void {
  const zone = findZone(ctx, commandBody(body).id).unarchive();
  ctx.zones.save(zone);
  publishZones(ctx);
}
