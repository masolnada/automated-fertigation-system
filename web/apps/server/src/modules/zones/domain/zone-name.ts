import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

export const ZONE_NAME_MAX = 40;

export class ZoneName extends ValueObject {
  private constructor(readonly value: string) { super(); }
  static create(value: unknown): Result<ZoneName> {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name) return err(new DomainError("empty_zone_name", "name must not be empty"));
    if (name.length > ZONE_NAME_MAX) return err(new DomainError("zone_name_too_long", `name must be at most ${ZONE_NAME_MAX} characters`));
    return ok(new ZoneName(name));
  }
  static rehydrate(value: unknown): ZoneName { const result = ZoneName.create(value); if (!result.ok) throw result.error; return result.value; }
  toString(): string { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.value]; }
}
