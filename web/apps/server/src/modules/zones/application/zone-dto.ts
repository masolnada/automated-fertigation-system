import type { Zone as ZoneDto } from "@hort/contracts";
import type { Zone } from "../domain/zone";

export const zoneDto = (zone: Zone): ZoneDto => ({
  id: zone.id.toString(),
  name: zone.name.toString(),
  archived: zone.archived,
});
