import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

export class DeviceTimestamp extends ValueObject {
  private constructor(private readonly date: Date | null) { super(); }
  static fromEpochSeconds(value: unknown): Result<DeviceTimestamp> {
    if (!Number.isInteger(value) || typeof value !== "number" || value < 0) return err(new DomainError("invalid_device_timestamp", "device timestamp must be a non-negative integer"));
    if (value === 0) return ok(new DeviceTimestamp(null));
    const date = new Date(value * 1000);
    return Number.isFinite(date.getTime()) ? ok(new DeviceTimestamp(date)) : err(new DomainError("invalid_device_timestamp", "device timestamp is outside the supported date range"));
  }
  static fromDate(value: Date | null): DeviceTimestamp {
    if (value === null) return new DeviceTimestamp(null);
    if (!Number.isFinite(value.getTime())) throw new DomainError("invalid_device_timestamp", "invalid persisted device timestamp");
    return new DeviceTimestamp(new Date(value));
  }
  isKnown(): boolean { return this.date !== null; }
  toDate(): Date | null { return this.date ? new Date(this.date) : null; }
  toIsoString(): string | null { return this.date?.toISOString() ?? null; }
  protected equalityComponents(): readonly unknown[] { return [this.date?.getTime() ?? null]; }
}
