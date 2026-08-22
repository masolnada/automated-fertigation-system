import type { ZoneContext } from "./context";
import { zoneDto } from "./zone-dto";

export function publishZones(ctx: ZoneContext): void {
  ctx.controller.setZones(ctx.zones.all().map(zoneDto), ctx.zones.currentAssignments().toRecord());
}
