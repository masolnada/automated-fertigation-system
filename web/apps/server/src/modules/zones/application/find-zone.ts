import { CommandError, unwrap } from "../../../application/command";
import { ZoneId } from "../domain/zone-id";
import type { Zone } from "../domain/zone";
import type { ZoneContext } from "./context";

export function findZone(ctx: ZoneContext, raw: unknown): Zone {
  const id = unwrap(ZoneId.create(raw));
  const zone = ctx.zones.find(id);
  if (!zone) throw new CommandError(404, "unknown zone");
  return zone;
}
