import { and, asc, desc, eq, lte } from "drizzle-orm";
import type { Zone } from "@hort/contracts";
import type { ZoneRepository } from "../../domain/ports";
import type { Db } from "./database";
import { outputAssignments, zones } from "./schema";

/**
 * Zones and the append-only assignation table (web ADR-0014). Names are
 * current-only (web ADR-0015), so a rename is an update; what stays temporal is
 * which channel fed which zone.
 */
export class DrizzleZoneRepository implements ZoneRepository {
  constructor(private db: Db) {}

  all(): Zone[] {
    return this.db.select().from(zones).orderBy(asc(zones.createdAt), asc(zones.id)).all();
  }

  create(name: string, at: Date = new Date()): Zone {
    const zone: Zone = { id: crypto.randomUUID(), name, archived: false };
    this.db.insert(zones).values({ ...zone, createdAt: at }).run();
    return zone;
  }

  rename(id: string, name: string): void {
    this.db.update(zones).set({ name }).where(eq(zones.id, id)).run();
  }

  /**
   * Archiving clears the assignment, so a current assignment always points at a
   * live zone. The clearing is itself an assignment row, so history keeps
   * pointing at this zone for everything it watered before now.
   */
  archive(id: string, at: Date = new Date()): void {
    this.db.transaction((tx) => {
      tx.update(zones).set({ archived: true }).where(eq(zones.id, id)).run();
      for (const [channel, zoneId] of Object.entries(this.currentAssignments(tx))) {
        if (zoneId === id) tx.insert(outputAssignments).values({ outputChannel: Number(channel), zoneId: null, validFrom: at }).run();
      }
    });
  }

  /** Unarchiving does not restore the assignment; it is reassigned explicitly. */
  unarchive(id: string): void {
    this.db.update(zones).set({ archived: false }).where(eq(zones.id, id)).run();
  }

  currentAssignments(db: Db = this.db): Record<number, string> {
    const rows = db.select().from(outputAssignments).orderBy(asc(outputAssignments.validFrom), asc(outputAssignments.id)).all();
    const current: Record<number, string> = {};
    for (const row of rows) {
      if (row.zoneId) current[row.outputChannel] = row.zoneId;
      else delete current[row.outputChannel];
    }
    return current;
  }

  /**
   * The whole table at once under one `validFrom`: one-to-one is a table-level
   * invariant, so a partial write could pass through a state it forbids. Only
   * the channels that actually changed get a row.
   */
  setAssignments(next: Record<number, string | null>, at: Date = new Date()): void {
    const current = this.currentAssignments();
    const changed = Object.entries(next).filter(([channel, zoneId]) => (current[Number(channel)] ?? null) !== (zoneId ?? null));
    if (changed.length === 0) return;
    this.db.insert(outputAssignments).values(changed.map(([channel, zoneId]) => ({ outputChannel: Number(channel), zoneId: zoneId ?? null, validFrom: at }))).run();
  }

  /**
   * The zone assigned to `channel` at `at`. Events with no valid clock fall back
   * to the current assignment, which is the closest thing on record.
   */
  zoneAt(channel: number, at: Date | null): string | null {
    const row = this.db.select().from(outputAssignments)
      .where(at ? and(eq(outputAssignments.outputChannel, channel), lte(outputAssignments.validFrom, at)) : eq(outputAssignments.outputChannel, channel))
      .orderBy(desc(outputAssignments.validFrom), desc(outputAssignments.id)).limit(1).get();
    if (row) return row.zoneId;
    // Predates the first assignment: fall back to the earliest on record, the
    // same reasoning ADR-0010 used for names before the first rename.
    const earliest = this.db.select().from(outputAssignments)
      .where(eq(outputAssignments.outputChannel, channel))
      .orderBy(asc(outputAssignments.validFrom), asc(outputAssignments.id)).limit(1).get();
    return earliest?.zoneId ?? null;
  }

  nameOf(zoneId: string): string | null {
    return this.db.select().from(zones).where(eq(zones.id, zoneId)).limit(1).get()?.name ?? null;
  }
}
