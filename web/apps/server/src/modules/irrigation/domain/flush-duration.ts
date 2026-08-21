import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

export class FlushDuration extends ValueObject {
  private constructor(readonly minutes: number) { super(); }

  static create(value: unknown): Result<FlushDuration> {
    if (typeof value !== "number" || !Number.isFinite(value)) return err(new DomainError("invalid_flush_duration", "flushMinutes must be a finite number"));
    return value >= 1 && value <= 60
      ? ok(new FlushDuration(value))
      : err(new DomainError("invalid_flush_duration", "flushMinutes out of range [1, 60]"));
  }

  static rehydrate(value: unknown): FlushDuration {
    const result = FlushDuration.create(value);
    if (!result.ok) throw result.error;
    return result.value;
  }

  toMinutes(): number { return this.minutes; }
  protected equalityComponents(): readonly unknown[] { return [this.minutes]; }
}
