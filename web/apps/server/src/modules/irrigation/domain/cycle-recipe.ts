import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";
import { cycleMode, type CycleMode } from "./cycle-mode";
import { CycleTarget } from "./cycle-target";
import { FlushDuration } from "./flush-duration";
import { PreWetPercentage } from "./pre-wet-percentage";

export type CycleRecipePrimitives = { mode: CycleMode; total: number; preWetPercent: number; flushMinutes: number };

export class CycleRecipe extends ValueObject {
  private constructor(
    readonly target: CycleTarget,
    readonly preWetPercentage: PreWetPercentage,
    readonly flushDuration: FlushDuration,
  ) { super(); }

  get mode(): CycleMode { return this.target.mode; }

  static create(raw: unknown): Result<CycleRecipe> {
    if (typeof raw !== "object" || raw === null) return err(new DomainError("invalid_cycle_recipe", "recipe must be an object"));
    const value = raw as Record<string, unknown>;
    const mode = cycleMode(value.mode); if (!mode.ok) return mode;
    const target = CycleTarget.create(mode.value, value.total); if (!target.ok) return target;
    const preWet = PreWetPercentage.create(value.preWetPercent); if (!preWet.ok) return preWet;
    const flush = FlushDuration.create(value.flushMinutes); if (!flush.ok) return flush;
    return ok(new CycleRecipe(target.value, preWet.value, flush.value));
  }

  static rehydrate(raw: unknown): CycleRecipe {
    const result = CycleRecipe.create(raw);
    if (!result.ok) throw result.error;
    return result.value;
  }

  toPrimitives(): CycleRecipePrimitives {
    return { mode: this.mode, total: this.target.toNumber(), preWetPercent: this.preWetPercentage.toNumber(), flushMinutes: this.flushDuration.toMinutes() };
  }

  protected equalityComponents(): readonly unknown[] {
    const value = this.toPrimitives();
    return [value.mode, value.total, value.preWetPercent, value.flushMinutes];
  }
}
