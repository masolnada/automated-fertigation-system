import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";
import { CalendarDate } from "./calendar-date";
import { IsoWeekday } from "./iso-weekday";
import { WeekdaySet } from "./weekday-set";

export type FrequencyPrimitives =
  | { kind: "weekdays"; days: number[] }
  | { kind: "everyN"; n: number; from: string };

const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);

export abstract class Frequency extends ValueObject {
  abstract readonly period: number;
  abstract readonly anchorEpochDay: number;
  abstract firesOn(date: CalendarDate): boolean;
  protected abstract firesOnEpochDay(day: number): boolean;
  abstract toPrimitives(): FrequencyPrimitives;

  sharesADayWith(other: Frequency): boolean {
    const start = Math.max(this.anchorEpochDay, other.anchorEpochDay);
    const period = (this.period * other.period) / gcd(this.period, other.period);
    for (let day = start; day < start + period; day++) if (this.firesOnEpochDay(day) && other.firesOnEpochDay(day)) return true;
    return false;
  }

  static create(raw: unknown): Result<Frequency> {
    if (typeof raw !== "object" || raw === null) return err(new DomainError("invalid_frequency", "frequency must be an object"));
    const value = raw as Record<string, unknown>;
    if (value.kind === "weekdays") return WeekdayFrequency.fromDays(value.days);
    if (value.kind === "everyN") return EveryNDaysFrequency.fromInterval(value.n, value.from);
    return err(new DomainError("invalid_frequency", "unknown frequency kind"));
  }

  static rehydrate(raw: unknown): Frequency { const result = Frequency.create(raw); if (!result.ok) throw result.error; return result.value; }
}

export class WeekdayFrequency extends Frequency {
  readonly period = 7;
  readonly anchorEpochDay = 0;
  private constructor(readonly weekdays: WeekdaySet) { super(); }

  static fromDays(days: unknown): Result<WeekdayFrequency> {
    const weekdays = WeekdaySet.create(days);
    return weekdays.ok ? ok(new WeekdayFrequency(weekdays.value)) : weekdays;
  }

  firesOn(date: CalendarDate): boolean { return this.firesOnEpochDay(date.toEpochDay()); }
  protected firesOnEpochDay(day: number): boolean { return this.weekdays.includes(IsoWeekday.fromEpochDay(day)); }
  toPrimitives(): FrequencyPrimitives { return { kind: "weekdays", days: this.weekdays.toNumbers() }; }
  protected equalityComponents(): readonly unknown[] { return ["weekdays", ...this.weekdays.toNumbers()]; }
}

export class EveryNDaysFrequency extends Frequency {
  private constructor(readonly n: number, readonly from: CalendarDate) { super(); }
  get period(): number { return this.n; }
  get anchorEpochDay(): number { return this.from.toEpochDay(); }

  static fromInterval(n: unknown, from: unknown): Result<EveryNDaysFrequency> {
    if (!Number.isInteger(n) || typeof n !== "number" || n < 1 || n > 90) return err(new DomainError("invalid_every_n_days", "n must be 1-90"));
    const date = CalendarDate.create(from);
    return date.ok ? ok(new EveryNDaysFrequency(n, date.value)) : date;
  }

  firesOn(date: CalendarDate): boolean { return this.firesOnEpochDay(date.toEpochDay()); }
  protected firesOnEpochDay(day: number): boolean { return day >= this.anchorEpochDay && (day - this.anchorEpochDay) % this.n === 0; }
  toPrimitives(): FrequencyPrimitives { return { kind: "everyN", n: this.n, from: this.from.toString() }; }
  protected equalityComponents(): readonly unknown[] { return ["everyN", this.n, this.from.toString()]; }
}
