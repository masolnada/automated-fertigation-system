import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

export class IsoWeekday extends ValueObject {
  private constructor(readonly value: 1 | 2 | 3 | 4 | 5 | 6 | 7) { super(); }

  static create(value: unknown): Result<IsoWeekday> {
    return Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 7
      ? ok(new IsoWeekday(value as 1 | 2 | 3 | 4 | 5 | 6 | 7))
      : err(new DomainError("invalid_iso_weekday", "days must be 1-7"));
  }

  static fromEpochDay(day: number): IsoWeekday { return new IsoWeekday((((day + 3) % 7 + 7) % 7 + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7); }
  toNumber(): number { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.value]; }
}
