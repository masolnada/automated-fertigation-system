import { and, asc, desc, eq, lte } from "drizzle-orm";
import type { ZoneNameRepository } from "../../domain/ports";
import type { Db } from "./database";
import { zoneNames } from "./schema";

/**
 * Append-only zone names (web ADR-0010). A rename inserts a new row rather than
 * updating, so an event that ran under the old name keeps it.
 */
export class DrizzleZoneNameRepository implements ZoneNameRepository {
  constructor(private db: Db) {}

  current(): Record<number, string> {
    const rows = this.db.select().from(zoneNames).orderBy(asc(zoneNames.validFrom), asc(zoneNames.id)).all();
    const names: Record<number, string> = {};
    for (const row of rows) names[row.zone] = row.name;
    return names;
  }

  rename(zone: number, name: string, at: Date = new Date()): void {
    const latest = this.db.select().from(zoneNames)
      .where(eq(zoneNames.zone, zone))
      .orderBy(desc(zoneNames.validFrom), desc(zoneNames.id)).limit(1).get();
    if (latest?.name === name) return;
    this.db.insert(zoneNames).values({ zone, name, validFrom: at }).run();
  }

  /**
   * The name in force for `zone` at `at`. Events with no valid clock (`at` null)
   * and events predating the first rename both fall back to the earliest name
   * on record, which is the closest thing to what they ran under.
   */
  nameAt(zone: number, at: Date | null): string | null {
    if (at) {
      const inForce = this.db.select().from(zoneNames)
        .where(and(eq(zoneNames.zone, zone), lte(zoneNames.validFrom, at)))
        .orderBy(desc(zoneNames.validFrom), desc(zoneNames.id)).limit(1).get();
      if (inForce) return inForce.name;
    }
    const earliest = this.db.select().from(zoneNames)
      .where(eq(zoneNames.zone, zone))
      .orderBy(asc(zoneNames.validFrom), asc(zoneNames.id)).limit(1).get();
    return earliest?.name ?? null;
  }
}
