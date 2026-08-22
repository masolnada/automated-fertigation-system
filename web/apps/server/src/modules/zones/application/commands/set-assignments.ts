import type { CommandBodies } from "@hort/contracts";
import { CommandError, commandBody, unwrap } from "../../../../application/command";
import { assignIneligibleReason } from "../../../../application/policies";
import { AssignmentTable } from "../../domain/assignment-table";
import type { ZoneContext } from "../context";
import { publishZones } from "../publish-zones";

export function setAssignments(ctx: ZoneContext, body: CommandBodies["set-assignments"]): void {
  const reason = assignIneligibleReason(ctx.controller.getSnapshot());
  if (reason) throw new CommandError(409, reason);
  const live = ctx.zones.all().filter((zone) => !zone.archived).map((zone) => zone.id);
  const table = unwrap(AssignmentTable.create(commandBody(body).assignments, live));
  ctx.zones.setAssignments(table, ctx.clock.now());
  publishZones(ctx);
}
