import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ScheduleId extends ValueObject {
  private constructor(readonly value: string) { super(); }
  static create(value: unknown): Result<ScheduleId> {
    return typeof value === "string" && UUID.test(value)
      ? ok(new ScheduleId(value.toLowerCase()))
      : err(new DomainError("invalid_schedule_id", "invalid schedule id"));
  }
  static rehydrate(value: unknown): ScheduleId { const result = ScheduleId.create(value); if (!result.ok) throw result.error; return result.value; }
  toString(): string { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.value]; }
}
