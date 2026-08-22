import type { CommandBodies } from "@hort/contracts";
import { commandBody, unwrap } from "../../../../application/command";
import { topics } from "../../../../application/controller-protocol";
import { cycleMode } from "../../domain/cycle-mode";
import type { IrrigationContext } from "../context";

export function setCycleMode(ctx: IrrigationContext, body: CommandBodies["set-cycle-mode"]): void {
  const mode = unwrap(cycleMode(commandBody(body).mode));
  ctx.device.publish(topics(ctx.device.prefix).selectCommand("default_cycle_mode"), mode);
}
