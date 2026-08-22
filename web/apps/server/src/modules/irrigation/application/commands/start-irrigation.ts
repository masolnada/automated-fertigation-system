import type { CommandBodies } from "@hort/contracts";
import { commandBody, unwrap } from "../../../../application/command";
import { topics } from "../../../../application/controller-protocol";
import { OutputChannel } from "../../../../shared-kernel/output-channel";
import { CycleRecipe } from "../../domain/cycle-recipe";
import type { IrrigationContext } from "../context";

export function startIrrigation(ctx: IrrigationContext, body: CommandBodies["start-irrigation"]): void {
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
}
