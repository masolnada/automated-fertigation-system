import { Entity } from "../../../shared-kernel/entity";
import { OutputChannel } from "../../../shared-kernel/output-channel";
import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { CycleRecipe } from "../../irrigation/domain/cycle-recipe";
import { Frequency } from "./frequency";
import { ScheduleId } from "./schedule-id";
import { TimeOfDay } from "./time-of-day";

export class ScheduleEntry extends Entity<ScheduleId> {
  private constructor(id: ScheduleId, readonly time: TimeOfDay, readonly frequency: Frequency, readonly channel: OutputChannel, readonly recipe: CycleRecipe) { super(id); }

  static create(raw: { id: unknown; time: unknown; frequency: unknown; channel: unknown; recipe: unknown }): Result<ScheduleEntry> {
    const id = ScheduleId.create(raw.id); if (!id.ok) return id;
    const time = TimeOfDay.create(raw.time); if (!time.ok) return time;
    const frequency = Frequency.create(raw.frequency); if (!frequency.ok) return frequency;
    const channel = OutputChannel.create(raw.channel); if (!channel.ok) return channel;
    const recipe = CycleRecipe.create(raw.recipe); if (!recipe.ok) return recipe;
    return ok(new ScheduleEntry(id.value, time.value, frequency.value, channel.value, recipe.value));
  }

  static rehydrate(raw: { id: unknown; time: unknown; frequency: unknown; channel: unknown; recipe: unknown }): ScheduleEntry {
    const result = ScheduleEntry.create(raw);
    if (!result.ok) throw new DomainError("invalid_persisted_schedule", result.error.message);
    return result.value;
  }
}
