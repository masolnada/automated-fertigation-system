import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

export class PreWetPercentage extends ValueObject {
  private constructor(readonly value: number) { super(); }

  static create(value: unknown): Result<PreWetPercentage> {
    if (typeof value !== "number" || !Number.isFinite(value)) return err(new DomainError("invalid_pre_wet_percentage", "preWetPercent must be a finite number"));
    return value >= 0 && value <= 100
      ? ok(new PreWetPercentage(value))
      : err(new DomainError("invalid_pre_wet_percentage", "preWetPercent out of range [0, 100]"));
  }

  static rehydrate(value: unknown): PreWetPercentage {
    const result = PreWetPercentage.create(value);
    if (!result.ok) throw result.error;
    return result.value;
  }

  toNumber(): number { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.value]; }
}
