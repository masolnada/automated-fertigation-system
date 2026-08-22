import { irrigationHandlers } from "../modules/irrigation/application/commands";
import { schedulingHandlers } from "../modules/scheduling/application/commands";
import { zoneHandlers } from "../modules/zones/application/commands";
import type { Context } from "./command";

export { CommandError, type Context, type ResetOutcome } from "./command";
export { RESET_TIMEOUT_MS } from "../modules/irrigation/application/commands/reset-total-water";
export { SCHEDULE_MAX } from "../modules/scheduling/domain/schedule-book";
export { ZONE_NAME_MAX } from "../modules/zones/domain/zone-name";

export const handlers = {
  ...irrigationHandlers,
  ...zoneHandlers,
  ...schedulingHandlers,
} satisfies Record<string, (ctx: Context, body: never) => unknown>;
