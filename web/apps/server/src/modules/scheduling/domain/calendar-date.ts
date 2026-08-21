import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

const DAY_MS = 86_400_000;
const leap = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const daysInMonth = (year: number, month: number) => [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;

export class CalendarDate extends ValueObject {
  private constructor(readonly year: number, readonly month: number, readonly day: number) { super(); }

  static create(value: unknown): Result<CalendarDate> {
    if (typeof value !== "string") return err(new DomainError("invalid_calendar_date", "from must be YYYY-MM-DD"));
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return err(new DomainError("invalid_calendar_date", "from must be YYYY-MM-DD"));
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return err(new DomainError("invalid_calendar_date", "from must be a real YYYY-MM-DD date"));
    return ok(new CalendarDate(year, month, day));
  }

  static rehydrate(value: unknown): CalendarDate {
    const result = CalendarDate.create(value);
    if (!result.ok) throw result.error;
    return result.value;
  }

  static fromEpochDay(epochDay: number): CalendarDate {
    const date = new Date(epochDay * DAY_MS);
    if (!Number.isInteger(epochDay) || !Number.isFinite(date.getTime())) throw new DomainError("invalid_calendar_date", "invalid epoch day");
    return new CalendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  toEpochDay(): number {
    const date = new Date(0);
    date.setUTCFullYear(this.year, this.month - 1, this.day);
    date.setUTCHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / DAY_MS);
  }

  toString(): string { return `${String(this.year).padStart(4, "0")}-${String(this.month).padStart(2, "0")}-${String(this.day).padStart(2, "0")}`; }
  protected equalityComponents(): readonly unknown[] { return [this.year, this.month, this.day]; }
}
