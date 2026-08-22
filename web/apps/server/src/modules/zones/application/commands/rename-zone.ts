import type { CommandBodies } from "@hort/contracts";
import { commandBody, unwrap } from "../../../../application/command";
import { ZoneName } from "../../domain/zone-name";
import type { ZoneContext } from "../context";
import { findZone } from "../find-zone";
import { publishZones } from "../publish-zones";

export function renameZone(ctx: ZoneContext, body: CommandBodies["rename-zone"]): void {
  const raw = commandBody(body);
  const zone = findZone(ctx, raw.id).rename(unwrap(ZoneName.create(raw.name)));
  ctx.zones.save(zone);
  publishZones(ctx);
}
