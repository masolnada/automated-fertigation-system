import type { OutputChannel } from "../../../shared-kernel/output-channel";
import type { AssignmentTable } from "../domain/assignment-table";
import type { Zone } from "../domain/zone";
import type { ZoneId } from "../domain/zone-id";
import type { ZoneName } from "../domain/zone-name";

export interface ZoneRepository {
  all(): Zone[];
  find(id: ZoneId): Zone | null;
  add(zone: Zone, createdAt: Date): void;
  save(zone: Zone): void;
  archive(zone: Zone, assignments: AssignmentTable, effectiveAt: Date): void;
  currentAssignments(): AssignmentTable;
  setAssignments(table: AssignmentTable, effectiveAt: Date): void;
  zoneAt(channel: OutputChannel, at: Date | null): ZoneId | null;
  nameOf(zoneId: ZoneId): ZoneName | null;
}
