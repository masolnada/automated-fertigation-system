import { topics } from "../../../application/controller-protocol";
import type { IrrigationContext } from "./context";

export function publishNumber(ctx: IrrigationContext, firmwareId: string, value: number): void {
  ctx.device.publish(topics(ctx.device.prefix).numberCommand(firmwareId), String(value));
}
