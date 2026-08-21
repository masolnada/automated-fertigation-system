import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { OutputChannel } from "../../../shared-kernel/output-channel";
import { ScheduleEntry } from "./schedule-entry";
import { ScheduleId } from "./schedule-id";

export const SCHEDULE_MAX = 16;

export class ScheduleBook {
  private constructor(readonly entries: readonly ScheduleEntry[]) {}
  static rehydrate(entries: readonly ScheduleEntry[]): ScheduleBook {
    let book = new ScheduleBook([]);
    for (const entry of entries) {
      const next = book.add(entry);
      if (!next.ok) throw new DomainError("invalid_persisted_schedule_book", next.error.message);
      book = next.value;
    }
    return book;
  }

  add(entry: ScheduleEntry): Result<ScheduleBook> {
    if (this.entries.length >= SCHEDULE_MAX) return err(new DomainError("schedule_capacity", `at most ${SCHEDULE_MAX} schedules`));
    const clash = this.entries.find((candidate) => candidate.time.equals(entry.time) && candidate.frequency.sharesADayWith(entry.frequency));
    if (clash) return err(new DomainError("schedule_collision", `${entry.time.toString()} is already taken by the schedule on output ${clash.channel.toNumber()}`));
    return ok(new ScheduleBook([...this.entries, entry]));
  }

  remove(id: ScheduleId): ScheduleBook { return new ScheduleBook(this.entries.filter((entry) => !entry.id.equals(id))); }
  removeForChannel(channel: OutputChannel): ScheduleBook { return new ScheduleBook(this.entries.filter((entry) => !entry.channel.equals(channel))); }
}
