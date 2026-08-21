import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ZoneId extends ValueObject {
  private constructor(readonly value: string) { super(); }
  static create(value: unknown): Result<ZoneId> {
    return typeof value === "string" && UUID.test(value)
      ? ok(new ZoneId(value.toLowerCase()))
      : err(new DomainError("invalid_zone_id", "invalid zone id"));
  }
  static rehydrate(value: unknown): ZoneId { const result = ZoneId.create(value); if (!result.ok) throw result.error; return result.value; }
  toString(): string { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.value]; }
}
