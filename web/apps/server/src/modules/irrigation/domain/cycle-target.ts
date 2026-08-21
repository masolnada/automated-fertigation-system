import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";
import type { CycleMode } from "./cycle-mode";

const limits: Record<CycleMode, { min: number; max: number }> = {
  Time: { min: 0, max: 180 },
  Volume: { min: 0, max: 500 },
};

export class CycleTarget extends ValueObject {
  private constructor(readonly mode: CycleMode, readonly value: number) { super(); }

  static create(mode: CycleMode, value: unknown): Result<CycleTarget> {
    const range = limits[mode];
    if (typeof value !== "number" || !Number.isFinite(value)) return err(new DomainError("invalid_cycle_target", "total must be a finite number"));
    if (value < range.min || value > range.max) return err(new DomainError("invalid_cycle_target", `total out of range [${range.min}, ${range.max}]`));
    return ok(new CycleTarget(mode, value));
  }

  static rehydrate(mode: CycleMode, value: unknown): CycleTarget {
    const result = CycleTarget.create(mode, value);
    if (!result.ok) throw result.error;
    return result.value;
  }

  toNumber(): number { return this.value; }
  protected equalityComponents(): readonly unknown[] { return [this.mode, this.value]; }
}
