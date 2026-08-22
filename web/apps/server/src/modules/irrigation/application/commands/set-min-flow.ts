import type { CommandBodies } from "@hort/contracts";
import { commandBody, unwrap } from "../../../../application/command";
import { MinimumFlow } from "../../domain/minimum-flow";
import type { IrrigationContext } from "../context";
import { publishNumber } from "../publish-number";

export function setMinFlow(ctx: IrrigationContext, body: CommandBodies["set-min-flow"]): void {
  publishNumber(ctx, "min_flow", unwrap(MinimumFlow.create(commandBody(body).value)).toNumber());
}
