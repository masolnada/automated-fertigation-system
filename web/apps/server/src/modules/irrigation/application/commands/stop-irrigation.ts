import { topics } from "../../../../application/controller-protocol";
import type { IrrigationContext } from "../context";

export function stopIrrigation(ctx: IrrigationContext): void {
  ctx.device.publish(topics(ctx.device.prefix).irrigationStop, "ON");
}
