import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";

export type WateringOutcomeValue = "completed" | "aborted" | "dry_run" | "recovery" | "skipped";
export class WateringOutcome extends ValueObject {
  private constructor(readonly value: WateringOutcomeValue) { super(); }
  static create(value: unknown): Result<WateringOutcome> {
    switch (value) {
      case "completed": case "aborted": case "dry_run": case "recovery": case "skipped": return ok(new WateringOutcome(value));
      default: return err(new DomainError("invalid_watering_outcome", "invalid watering outcome"));
    }
  }
  static rehydrate(value: unknown): WateringOutcome { const result = WateringOutcome.create(value); if (!result.ok) throw result.error; return result.value; }
  toString(): WateringOutcomeValue { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.value]; }
}
