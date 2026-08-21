import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

export class TimeOfDay extends ValueObject {
  private constructor(readonly hour: number, readonly minute: number) { super(); }

  static create(value: unknown): Result<TimeOfDay> {
    if (typeof value !== "string") return err(new DomainError("invalid_time_of_day", "time must be HH:MM"));
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    return match
      ? ok(new TimeOfDay(Number(match[1]), Number(match[2])))
      : err(new DomainError("invalid_time_of_day", "time must be HH:MM"));
  }

  static rehydrate(value: unknown): TimeOfDay {
    const result = TimeOfDay.create(value);
    if (!result.ok) throw result.error;
    return result.value;
  }

  compare(other: TimeOfDay): number { return this.hour * 60 + this.minute - (other.hour * 60 + other.minute); }
  toString(): string { return `${String(this.hour).padStart(2, "0")}:${String(this.minute).padStart(2, "0")}`; }
  protected equalityComponents(): readonly unknown[] { return [this.hour, this.minute]; }
}
