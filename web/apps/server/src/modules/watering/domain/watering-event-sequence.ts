import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

/** The controller's uint32 counter starts at zero. */
export class WateringEventSequence extends ValueObject {
  private constructor(readonly value: number) { super(); }
  static create(value: unknown): Result<WateringEventSequence> {
    return Number.isInteger(value) && typeof value === "number" && value >= 0 && value <= 0xffff_ffff
      ? ok(new WateringEventSequence(value))
      : err(new DomainError("invalid_watering_sequence", "watering event sequence must be a non-negative uint32"));
  }
  static rehydrate(value: unknown): WateringEventSequence { const result = WateringEventSequence.create(value); if (!result.ok) throw result.error; return result.value; }
  toNumber(): number { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.value]; }
}
