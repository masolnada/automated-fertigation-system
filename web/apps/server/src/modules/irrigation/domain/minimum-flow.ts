import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

export class MinimumFlow extends ValueObject {
  private constructor(readonly value: number) { super(); }

  static create(value: unknown): Result<MinimumFlow> {
    if (typeof value !== "number" || !Number.isFinite(value)) return err(new DomainError("invalid_minimum_flow", "value must be a finite number"));
    return value >= 0 && value <= 10
      ? ok(new MinimumFlow(value))
      : err(new DomainError("invalid_minimum_flow", "min_flow out of range [0, 10]"));
  }

  static rehydrate(value: unknown): MinimumFlow {
    const result = MinimumFlow.create(value);
    if (!result.ok) throw result.error;
    return result.value;
  }

  toNumber(): number { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.value]; }
}
