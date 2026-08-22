import type { ResetResult } from "@hort/contracts";
import { CommandError, type ResetOutcome } from "../../../../application/command";
import { topics } from "../../../../application/controller-protocol";
import { canReset, resetIneligibleReason } from "../../../../application/policies";
import type { IrrigationContext } from "../context";

export const RESET_TIMEOUT_MS = 10_000;

const isResetResult = (value: string): value is ResetResult =>
  value === "success"
  || value === "already_zero"
  || value === "rejected_pump_running"
  || value === "rejected_flow_active"
  || value === "rejected_flow_unknown"
  || value === "error_persistence";

export async function resetTotalWater(ctx: IrrigationContext): Promise<ResetOutcome> {
  const reason = resetIneligibleReason(ctx.controller.getSnapshot());
  if (reason) throw new CommandError(409, reason);
  if (!canReset(ctx.controller.getSnapshot())) throw new CommandError(409, "reset unavailable");
  ctx.controller.setResetPending(true);
  return await new Promise<ResetOutcome>((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      ctx.controller.setResetPending(false);
      resolve({ result: "timeout" });
    }, ctx.resetTimeoutMs ?? RESET_TIMEOUT_MS);
    const unsubscribe = ctx.device.onResetResult((result) => {
      clearTimeout(timer);
      unsubscribe();
      resolve({ result: isResetResult(result) ? result : "unexpected_response" });
    });
    ctx.device.publish(topics(ctx.device.prefix).resetRequest, "ON", { retain: false });
  });
}
