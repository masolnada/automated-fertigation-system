import { sourceIds, type CommandBodies, type ResetResult } from "@hort/contracts";
import { CommandError, commandBody, unwrap, type Context, type ResetOutcome } from "../../../application/command";
import { topics } from "../../../application/controller-protocol";
import { canReset, resetIneligibleReason } from "../../../application/policies";
import { OutputChannel, outputChannels } from "../../../shared-kernel/output-channel";
import { cycleMode } from "../domain/cycle-mode";
import { CycleRecipe } from "../domain/cycle-recipe";
import { CycleTarget } from "../domain/cycle-target";
import { FlushDuration } from "../domain/flush-duration";
import { MinimumFlow } from "../domain/minimum-flow";
import { PreWetPercentage } from "../domain/pre-wet-percentage";

export type IrrigationContext = Pick<Context, "device" | "controller" | "resetTimeoutMs">;
export const RESET_TIMEOUT_MS = 10_000;

const isResetResult = (value: string): value is ResetResult =>
  value === "success"
  || value === "already_zero"
  || value === "rejected_pump_running"
  || value === "rejected_flow_active"
  || value === "rejected_flow_unknown"
  || value === "error_persistence";

const numberValue = (body: unknown): unknown => commandBody(body).value;
const publishNumber = (ctx: IrrigationContext, firmwareId: string, value: number): void => {
  ctx.device.publish(topics(ctx.device.prefix).numberCommand(firmwareId), String(value));
};

export const irrigationHandlers = {
  "start-irrigation": (ctx: IrrigationContext, body: CommandBodies["start-irrigation"]) => {
    const raw = commandBody(body);
    const channel = unwrap(OutputChannel.create(raw.channel));
    const recipe = unwrap(CycleRecipe.create(raw.recipe)).toPrimitives();
    ctx.device.publish(topics(ctx.device.prefix).irrigationStart, JSON.stringify({
      channel: channel.toNumber(),
      volume: recipe.mode === "Volume" ? 1 : 0,
      total: recipe.total,
      prewet: recipe.preWetPercent,
      flush: recipe.flushMinutes,
    }));
  },
  "stop-irrigation": (ctx: IrrigationContext) => {
    ctx.device.publish(topics(ctx.device.prefix).irrigationStop, "ON");
  },
  "toggle-pump": (ctx: IrrigationContext) => {
    ctx.device.publish(topics(ctx.device.prefix).switchCommand("pump"), "TOGGLE");
  },
  "select-valve": (ctx: IrrigationContext, body: CommandBodies["select-valve"]) => {
    const valve = commandBody(body).valve;
    if (valve !== "" && (typeof valve !== "string" || !(sourceIds as string[]).includes(valve))) {
      throw new CommandError(400, "invalid valve");
    }
    const controllerTopics = topics(ctx.device.prefix);
    for (const id of sourceIds) {
      if (id !== valve) ctx.device.publish(controllerTopics.switchCommand(id), "OFF");
    }
    if (valve) ctx.device.publish(controllerTopics.switchCommand(String(valve)), "ON");
  },
  "select-output": (ctx: IrrigationContext, body: CommandBodies["select-output"]) => {
    const raw = commandBody(body).channel;
    const selected = raw === 0 ? null : unwrap(OutputChannel.create(raw));
    const controllerTopics = topics(ctx.device.prefix);
    for (const channel of outputChannels) {
      if (!selected?.equals(channel)) {
        ctx.device.publish(controllerTopics.switchCommand(`output_${channel.toNumber()}`), "OFF");
      }
    }
    if (selected) ctx.device.publish(controllerTopics.switchCommand(`output_${selected.toNumber()}`), "ON");
  },
  "set-cycle-mode": (ctx: IrrigationContext, body: CommandBodies["set-cycle-mode"]) => {
    const mode = unwrap(cycleMode(commandBody(body).mode));
    ctx.device.publish(topics(ctx.device.prefix).selectCommand("default_cycle_mode"), mode);
  },
  "set-pre-wet-percent": (ctx: IrrigationContext, body: CommandBodies["set-pre-wet-percent"]) => {
    publishNumber(ctx, "default_pre-wet_percent", unwrap(PreWetPercentage.create(numberValue(body))).toNumber());
  },
  "set-cycle-target": (ctx: IrrigationContext, body: CommandBodies["set-cycle-target"]) => {
    const mode = ctx.controller.getSnapshot().entities.default_cycle_mode?.value === "Volume" ? "Volume" : "Time";
    const target = unwrap(CycleTarget.create(mode, numberValue(body)));
    publishNumber(ctx, mode === "Volume" ? "default_cycle_liters" : "default_cycle_minutes", target.toNumber());
  },
  "set-flush-duration": (ctx: IrrigationContext, body: CommandBodies["set-flush-duration"]) => {
    publishNumber(ctx, "default_flush_minutes", unwrap(FlushDuration.create(numberValue(body))).toMinutes());
  },
  "set-min-flow": (ctx: IrrigationContext, body: CommandBodies["set-min-flow"]) => {
    publishNumber(ctx, "min_flow", unwrap(MinimumFlow.create(numberValue(body))).toNumber());
  },
  "reset-total-water": async (ctx: IrrigationContext): Promise<ResetOutcome> => {
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
  },
};
