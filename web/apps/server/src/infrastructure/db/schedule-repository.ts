import { asc, eq } from "drizzle-orm";
import type { CycleMode, Frequency, OutputChannel, ScheduleEntry } from "@hort/contracts";
import type { ScheduleRepository } from "../../domain/ports";
import type { Db } from "./database";
import { schedules } from "./schema";

type Row = typeof schedules.$inferSelect;

const toEntry = (row: Row): ScheduleEntry => ({
  id: row.id,
  time: row.time,
  frequency: JSON.parse(row.frequency) as Frequency,
  channel: row.outputChannel as OutputChannel,
  recipe: { mode: row.cycleMode as CycleMode, total: row.cycleTotal, preWetPercent: row.preWetPercent, flushMinutes: row.flushMinutes },
});

/**
 * Schedule entries (web ADR-0017). Immutable, so this has no update path: a
 * changed schedule is a delete and a create, which is also what keeps the
 * device's copy simple to replace wholesale.
 */
export class DrizzleScheduleRepository implements ScheduleRepository {
  constructor(private db: Db) {}

  all(): ScheduleEntry[] {
    return this.db.select().from(schedules).orderBy(asc(schedules.createdAt), asc(schedules.id)).all().map(toEntry);
  }

  create(entry: { time: string; frequency: Frequency; channel: OutputChannel; recipe: ScheduleEntry["recipe"] }, at: Date = new Date()): ScheduleEntry {
    const row = {
      id: crypto.randomUUID(),
      time: entry.time,
      frequency: JSON.stringify(entry.frequency),
      outputChannel: entry.channel,
      cycleMode: entry.recipe.mode,
      cycleTotal: entry.recipe.total,
      preWetPercent: entry.recipe.preWetPercent,
      flushMinutes: entry.recipe.flushMinutes,
      createdAt: at,
    };
    this.db.insert(schedules).values(row).run();
    return toEntry(row as Row);
  }

  remove(id: string): void {
    this.db.delete(schedules).where(eq(schedules.id, id)).run();
  }

  /** Archiving a zone takes its schedules with it: they would otherwise keep watering a place taken out of service. */
  removeForChannel(channel: number): void {
    this.db.delete(schedules).where(eq(schedules.outputChannel, channel)).run();
  }
}
