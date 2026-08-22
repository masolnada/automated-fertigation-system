import type { CommandBodies } from "@hort/contracts";
import { commandBody, unwrap } from "../../../../application/command";
import { topics } from "../../../../application/controller-protocol";
import { OutputChannel, outputChannels } from "../../../../shared-kernel/output-channel";
import type { IrrigationContext } from "../context";

export function selectOutput(ctx: IrrigationContext, body: CommandBodies["select-output"]): void {
  const raw = commandBody(body).channel;
  const selected = raw === 0 ? null : unwrap(OutputChannel.create(raw));
  const controllerTopics = topics(ctx.device.prefix);
  for (const channel of outputChannels) {
    if (!selected?.equals(channel)) {
      ctx.device.publish(controllerTopics.switchCommand(`output_${channel.toNumber()}`), "OFF");
    }
  }
  if (selected) ctx.device.publish(controllerTopics.switchCommand(`output_${selected.toNumber()}`), "ON");
}
