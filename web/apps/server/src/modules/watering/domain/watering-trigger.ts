import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

export type WateringTriggerValue = "manual" | "sequence" | "scheduled";
export class WateringTrigger extends ValueObject {
  private constructor(readonly value: WateringTriggerValue) { super(); }
  static create(value: unknown): Result<WateringTrigger> {
    switch (value) {
      case "manual": case "sequence": case "scheduled": return ok(new WateringTrigger(value));
      default: return err(new DomainError("invalid_watering_trigger", "invalid watering trigger"));
    }
  }
  static rehydrate(value: unknown): WateringTrigger { const result = WateringTrigger.create(value); if (!result.ok) throw result.error; return result.value; }
  toString(): WateringTriggerValue { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.value]; }
}
