import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";

export type CycleMode = "Time" | "Volume";

export function cycleMode(value: unknown): Result<CycleMode> {
  return value === "Time" || value === "Volume"
    ? ok(value)
    : err(new DomainError("invalid_cycle_mode", "invalid cycle mode"));
}
