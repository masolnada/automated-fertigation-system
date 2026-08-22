import { topics } from "../../../../application/controller-protocol";
import type { IrrigationContext } from "../context";

export function togglePump(ctx: IrrigationContext): void {
  ctx.device.publish(topics(ctx.device.prefix).switchCommand("pump"), "TOGGLE");
}
