import { irrigationHandlers } from "../modules/irrigation/application/handlers";
import { schedulingHandlers } from "../modules/scheduling/application/handlers";
import { zoneHandlers } from "../modules/zones/application/handlers";
import type { Context } from "./command";

export { CommandError, type Context, type ResetOutcome } from "./command";
export { RESET_TIMEOUT_MS } from "../modules/irrigation/application/handlers";
export { SCHEDULE_MAX } from "../modules/scheduling/domain/schedule-book";
export { ZONE_NAME_MAX } from "../modules/zones/domain/zone-name";

export const handlers = {
  ...irrigationHandlers,
  ...zoneHandlers,
  ...schedulingHandlers,
} satisfies Record<string, (ctx: Context, body: never) => unknown>;
