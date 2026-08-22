import type { CommandBodies } from "@hort/contracts";
import { commandBody, unwrap } from "../../../../application/command";
import { FlushDuration } from "../../domain/flush-duration";
import type { IrrigationContext } from "../context";
import { publishNumber } from "../publish-number";

export function setFlushDuration(ctx: IrrigationContext, body: CommandBodies["set-flush-duration"]): void {
  publishNumber(ctx, "default_flush_minutes", unwrap(FlushDuration.create(commandBody(body).value)).toMinutes());
}
