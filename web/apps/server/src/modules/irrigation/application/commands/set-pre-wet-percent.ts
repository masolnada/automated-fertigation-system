import type { CommandBodies } from "@hort/contracts";
import { commandBody, unwrap } from "../../../../application/command";
import { PreWetPercentage } from "../../domain/pre-wet-percentage";
import type { IrrigationContext } from "../context";
import { publishNumber } from "../publish-number";

export function setPreWetPercent(ctx: IrrigationContext, body: CommandBodies["set-pre-wet-percent"]): void {
  publishNumber(ctx, "default_pre-wet_percent", unwrap(PreWetPercentage.create(commandBody(body).value)).toNumber());
}
