import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";
import { DeviceTimestamp } from "./device-timestamp";

export class WateringTimeRange extends ValueObject {
  private constructor(readonly startedAt: DeviceTimestamp, readonly endedAt: DeviceTimestamp) { super(); }
  static fromEpochSeconds(start: unknown, end: unknown): Result<WateringTimeRange> {
    const startedAt = DeviceTimestamp.fromEpochSeconds(start); if (!startedAt.ok) return startedAt;
    const endedAt = DeviceTimestamp.fromEpochSeconds(end); if (!endedAt.ok) return endedAt;
    return WateringTimeRange.create(startedAt.value, endedAt.value);
  }
  static create(startedAt: DeviceTimestamp, endedAt: DeviceTimestamp): Result<WateringTimeRange> {
    const start = startedAt.toDate(), end = endedAt.toDate();
    if (start && end && end < start) return err(new DomainError("invalid_watering_time_range", "watering event end precedes start"));
    return ok(new WateringTimeRange(startedAt, endedAt));
  }
  static rehydrate(start: Date | null, end: Date | null): WateringTimeRange { const result = WateringTimeRange.create(DeviceTimestamp.fromDate(start), DeviceTimestamp.fromDate(end)); if (!result.ok) throw result.error; return result.value; }
  protected equalityComponents(): readonly unknown[] { return [this.startedAt.toDate()?.getTime() ?? null, this.endedAt.toDate()?.getTime() ?? null]; }
}
