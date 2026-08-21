import { asc, eq } from "drizzle-orm";
import type { Db } from "../../../infrastructure/db/database";
import { schedules } from "../../../infrastructure/db/schema";
import type { OutputChannel } from "../../../shared-kernel/output-channel";
import type { ScheduleRepository } from "../application/schedule-repository";
import { ScheduleEntry } from "../domain/schedule-entry";
import type { ScheduleId } from "../domain/schedule-id";

export class DrizzleScheduleRepository implements ScheduleRepository {
  constructor(private db: Db) {}
  all(): ScheduleEntry[] {
    return this.db.select().from(schedules).orderBy(asc(schedules.createdAt), asc(schedules.id)).all().map((row) => ScheduleEntry.rehydrate({
      id: row.id, time: row.time, frequency: JSON.parse(row.frequency), channel: row.outputChannel,
      recipe: { mode: row.cycleMode, total: row.cycleTotal, preWetPercent: row.preWetPercent, flushMinutes: row.flushMinutes },
    }));
  }
  save(entry: ScheduleEntry, createdAt: Date): void {
    const recipe = entry.recipe.toPrimitives();
    this.db.insert(schedules).values({ id: entry.id.toString(), time: entry.time.toString(), frequency: JSON.stringify(entry.frequency.toPrimitives()), outputChannel: entry.channel.toNumber(), cycleMode: recipe.mode, cycleTotal: recipe.total, preWetPercent: recipe.preWetPercent, flushMinutes: recipe.flushMinutes, createdAt }).run();
  }
  remove(id: ScheduleId): void { this.db.delete(schedules).where(eq(schedules.id, id.toString())).run(); }
  removeForChannel(channel: OutputChannel): void { this.db.delete(schedules).where(eq(schedules.outputChannel, channel.toNumber())).run(); }
}
