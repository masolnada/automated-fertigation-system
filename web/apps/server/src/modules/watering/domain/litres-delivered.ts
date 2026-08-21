import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

export class LitresDelivered extends ValueObject {
  private constructor(readonly value: number) { super(); }
  static create(value: unknown): Result<LitresDelivered> {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? ok(new LitresDelivered(value))
      : err(new DomainError("invalid_litres_delivered", "litres delivered must be finite and non-negative"));
  }
  static rehydrate(value: unknown): LitresDelivered { const result = LitresDelivered.create(value); if (!result.ok) throw result.error; return result.value; }
  toNumber(): number { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.value]; }
}
