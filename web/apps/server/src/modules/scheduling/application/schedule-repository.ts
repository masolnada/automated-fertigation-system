import type { OutputChannel } from "../../../shared-kernel/output-channel";
import type { ScheduleEntry } from "../domain/schedule-entry";
import type { ScheduleId } from "../domain/schedule-id";

export interface ScheduleRepository {
  all(): ScheduleEntry[];
  save(entry: ScheduleEntry, createdAt: Date): void;
  remove(id: ScheduleId): void;
  removeForChannel(channel: OutputChannel): void;
}
