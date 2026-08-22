import { sourceIds, type CommandBodies } from "@hort/contracts";
import { CommandError, commandBody } from "../../../../application/command";
import { topics } from "../../../../application/controller-protocol";
import type { IrrigationContext } from "../context";

export function selectValve(ctx: IrrigationContext, body: CommandBodies["select-valve"]): void {
  const valve = commandBody(body).valve;
  if (valve !== "" && (typeof valve !== "string" || !(sourceIds as string[]).includes(valve))) {
    throw new CommandError(400, "invalid valve");
  }
  const controllerTopics = topics(ctx.device.prefix);
  for (const id of sourceIds) {
    if (id !== valve) ctx.device.publish(controllerTopics.switchCommand(id), "OFF");
  }
  if (valve) ctx.device.publish(controllerTopics.switchCommand(String(valve)), "ON");
}
