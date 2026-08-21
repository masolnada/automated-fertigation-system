import { and, asc, desc, eq, lte } from "drizzle-orm";
import type { Db } from "../../../infrastructure/db/database";
import { outputAssignments, zones } from "../../../infrastructure/db/schema";
import { OutputChannel } from "../../../shared-kernel/output-channel";
import { AssignmentTable } from "../domain/assignment-table";
import { Zone } from "../domain/zone";
import { ZoneId } from "../domain/zone-id";
import { ZoneName } from "../domain/zone-name";
import type { ZoneRepository } from "../application/zone-repository";

export class DrizzleZoneRepository implements ZoneRepository {
  constructor(private db: Db) {}

  all(): Zone[] { return this.db.select().from(zones).orderBy(asc(zones.createdAt), asc(zones.id)).all().map((row) => Zone.rehydrate(ZoneId.rehydrate(row.id), ZoneName.rehydrate(row.name), row.archived)); }
  find(id: ZoneId): Zone | null { const row = this.db.select().from(zones).where(eq(zones.id, id.toString())).limit(1).get(); return row ? Zone.rehydrate(id, ZoneName.rehydrate(row.name), row.archived) : null; }
  add(zone: Zone, createdAt: Date): void { this.db.insert(zones).values({ id: zone.id.toString(), name: zone.name.toString(), archived: zone.archived, createdAt }).run(); }
  save(zone: Zone): void { this.db.update(zones).set({ name: zone.name.toString(), archived: zone.archived }).where(eq(zones.id, zone.id.toString())).run(); }

  archive(zone: Zone, assignments: AssignmentTable, effectiveAt: Date): void {
    this.db.transaction((tx) => {
      tx.update(zones).set({ name: zone.name.toString(), archived: zone.archived }).where(eq(zones.id, zone.id.toString())).run();
      this.writeAssignments(assignments, effectiveAt, tx as Db);
    });
  }

  currentAssignments(): AssignmentTable { return this.readAssignments(this.db); }
  private readAssignments(db: Db): AssignmentTable {
    const rows = db.select().from(outputAssignments).orderBy(asc(outputAssignments.validFrom), asc(outputAssignments.id)).all();
    const current = new Map<number, ZoneId | null>();
    for (const row of rows) current.set(row.outputChannel, row.zoneId ? ZoneId.rehydrate(row.zoneId) : null);
    return AssignmentTable.rehydrate([...current].map(([channel, zone]) => [OutputChannel.rehydrate(channel), zone] as const));
  }

  setAssignments(table: AssignmentTable, effectiveAt: Date): void { this.writeAssignments(table, effectiveAt, this.db); }
  private writeAssignments(table: AssignmentTable, effectiveAt: Date, db: Db): void {
    const current = this.readAssignments(db);
    const changed = table.entries().filter(([channel, zone]) => (current.zoneOn(channel)?.toString() ?? null) !== (zone?.toString() ?? null));
    if (changed.length > 0) db.insert(outputAssignments).values(changed.map(([channel, zone]) => ({ outputChannel: channel.toNumber(), zoneId: zone?.toString() ?? null, validFrom: effectiveAt }))).run();
  }

  zoneAt(channel: OutputChannel, at: Date | null): ZoneId | null {
    const condition = at ? and(eq(outputAssignments.outputChannel, channel.toNumber()), lte(outputAssignments.validFrom, at)) : eq(outputAssignments.outputChannel, channel.toNumber());
    const row = this.db.select().from(outputAssignments).where(condition).orderBy(desc(outputAssignments.validFrom), desc(outputAssignments.id)).limit(1).get();
    if (row) return row.zoneId ? ZoneId.rehydrate(row.zoneId) : null;
    const earliest = this.db.select().from(outputAssignments).where(eq(outputAssignments.outputChannel, channel.toNumber())).orderBy(asc(outputAssignments.validFrom), asc(outputAssignments.id)).limit(1).get();
    return earliest?.zoneId ? ZoneId.rehydrate(earliest.zoneId) : null;
  }

  nameOf(zoneId: ZoneId): ZoneName | null { const row = this.db.select({ name: zones.name }).from(zones).where(eq(zones.id, zoneId.toString())).limit(1).get(); return row ? ZoneName.rehydrate(row.name) : null; }
}
