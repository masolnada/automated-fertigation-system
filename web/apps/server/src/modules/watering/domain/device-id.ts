import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

export class DeviceId extends ValueObject {
  private constructor(readonly value: string) { super(); }
  static create(value: unknown): Result<DeviceId> {
    return typeof value === "string" && value.trim() !== ""
      ? ok(new DeviceId(value))
      : err(new DomainError("invalid_device_id", "device id must not be empty"));
  }
  static rehydrate(value: unknown): DeviceId { const result = DeviceId.create(value); if (!result.ok) throw result.error; return result.value; }
  toString(): string { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.value]; }
}
