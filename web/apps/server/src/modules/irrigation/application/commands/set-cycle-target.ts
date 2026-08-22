import type { CommandBodies } from "@hort/contracts";
import { commandBody, unwrap } from "../../../../application/command";
import { CycleTarget } from "../../domain/cycle-target";
import type { IrrigationContext } from "../context";
import { publishNumber } from "../publish-number";

export function setCycleTarget(ctx: IrrigationContext, body: CommandBodies["set-cycle-target"]): void {
  const mode = ctx.controller.getSnapshot().entities.default_cycle_mode?.value === "Volume" ? "Volume" : "Time";
  const target = unwrap(CycleTarget.create(mode, commandBody(body).value));
  publishNumber(ctx, mode === "Volume" ? "default_cycle_liters" : "default_cycle_minutes", target.toNumber());
}
