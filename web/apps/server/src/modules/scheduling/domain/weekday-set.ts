import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";
import { IsoWeekday } from "./iso-weekday";

export class WeekdaySet extends ValueObject {
  private constructor(readonly days: readonly IsoWeekday[]) { super(); }

  static create(value: unknown): Result<WeekdaySet> {
    if (!Array.isArray(value) || value.length === 0) return err(new DomainError("empty_weekday_set", "choose at least one day"));
    const unique = new Map<number, IsoWeekday>();
    for (const raw of value) {
      const day = IsoWeekday.create(raw);
      if (!day.ok) return day;
      unique.set(day.value.toNumber(), day.value);
    }
    return ok(new WeekdaySet([...unique.values()].sort((a, b) => a.toNumber() - b.toNumber())));
  }

  static rehydrate(value: unknown): WeekdaySet {
    const result = WeekdaySet.create(value);
    if (!result.ok) throw result.error;
    return result.value;
  }

  includes(day: IsoWeekday): boolean { return this.days.some((candidate) => candidate.equals(day)); }
  toNumbers(): number[] { return this.days.map((day) => day.toNumber()); }
  toBitMask(): number { return this.days.reduce((mask, day) => mask | (1 << (day.toNumber() - 1)), 0); }
  protected equalityComponents(): readonly unknown[] { return this.toNumbers(); }
}
