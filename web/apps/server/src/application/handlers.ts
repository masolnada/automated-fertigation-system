import { sourceIds, zoneNumbers, type CommandBodies, type ResetResult } from "@hort/contracts";
import type { Controller } from "../domain/controller";
import type { DevicePort, WateringEventRepository, ZoneNameRepository } from "../domain/ports";
import { canReset, inRange, ranges, resetIneligibleReason, type RangeId } from "../domain/policies";
import { topics } from "../domain/topics";

/** Thrown by handlers to signal an HTTP status: 400 invalid body/range, 409 guard failure. */
export class CommandError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export type ResetOutcome = { result: ResetResult | "timeout" };
export const RESET_TIMEOUT_MS = 10_000;

export type Context = { device: DevicePort; controller: Controller; wateringEvents?: WateringEventRepository; zoneNames?: ZoneNameRepository; resetTimeoutMs?: number };

export const ZONE_NAME_MAX = 40;

function numberBody(body: unknown): number {
  const value = (body as { value?: unknown })?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new CommandError(400, "value must be a finite number");
  return value;
}
function setNumber(ctx: Context, id: RangeId, value: number): void {
  if (!inRange(id, value)) throw new CommandError(400, `${id} out of range [${ranges[id].min}, ${ranges[id].max}]`);
  ctx.device.publish(topics(ctx.device.prefix).numberCommand(id), String(value));
}

export const handlers = {
  "start-irrigation": (ctx: Context) => { ctx.device.publish(topics(ctx.device.prefix).irrigationStart, "ON"); },
  "stop-irrigation": (ctx: Context) => { ctx.device.publish(topics(ctx.device.prefix).irrigationStop, "ON"); },
  "toggle-pump": (ctx: Context) => { ctx.device.publish(topics(ctx.device.prefix).switchCommand("pump"), "TOGGLE"); },
  "select-valve": (ctx: Context, body: CommandBodies["select-valve"]) => {
    const valve = body?.valve;
    if (valve !== "" && !(sourceIds as string[]).includes(valve)) throw new CommandError(400, "invalid valve");
    const t = topics(ctx.device.prefix);
    // Shut the others first: exactly one source is open at a time, and the
    // device's own interlock stops the pump if that leaves no path.
    for (const id of sourceIds) if (id !== valve) ctx.device.publish(t.switchCommand(id), "OFF");
    if (valve) ctx.device.publish(t.switchCommand(valve), "ON");
  },
  "select-zone": (ctx: Context, body: CommandBodies["select-zone"]) => {
    const zone = body?.zone;
    if (!Number.isInteger(zone) || (zone !== 0 && !(zoneNumbers as readonly number[]).includes(zone))) throw new CommandError(400, "invalid zone");
    const t = topics(ctx.device.prefix);
    for (const n of zoneNumbers) if (n !== zone) ctx.device.publish(t.switchCommand(`zone_${n}`), "OFF");
    if (zone) ctx.device.publish(t.switchCommand(`zone_${zone}`), "ON");
  },
  "set-zone-name": (ctx: Context, body: CommandBodies["set-zone-name"]) => {
    const zone = body?.zone;
    if (!Number.isInteger(zone) || !(zoneNumbers as readonly number[]).includes(zone)) throw new CommandError(400, "invalid zone");
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) throw new CommandError(400, "name must not be empty");
    if (name.length > ZONE_NAME_MAX) throw new CommandError(400, `name must be at most ${ZONE_NAME_MAX} characters`);
    if (!ctx.zoneNames) throw new CommandError(409, "zone names unavailable");
    ctx.zoneNames.rename(zone, name);
    ctx.controller.setZoneNames(ctx.zoneNames.current());
  },
  "set-cycle-mode": (ctx: Context, body: CommandBodies["set-cycle-mode"]) => {
    const mode = body?.mode;
    if (mode !== "Time" && mode !== "Volume") throw new CommandError(400, "invalid mode");
    ctx.device.publish(topics(ctx.device.prefix).selectCommand("cycle_mode"), mode);
  },
  "set-pre-wet-percent": (ctx: Context, body: CommandBodies["set-pre-wet-percent"]) => setNumber(ctx, "pre-wet_percent", numberBody(body)),
  "set-cycle-target": (ctx: Context, body: CommandBodies["set-cycle-target"]) => {
    const id: RangeId = ctx.controller.getSnapshot().entities.cycle_mode?.value === "Volume" ? "cycle_liters" : "cycle_minutes";
    setNumber(ctx, id, numberBody(body));
  },
  "set-flush-duration": (ctx: Context, body: CommandBodies["set-flush-duration"]) => setNumber(ctx, "flush_minutes", numberBody(body)),
  "set-min-flow": (ctx: Context, body: CommandBodies["set-min-flow"]) => setNumber(ctx, "min_flow", numberBody(body)),
  "reset-total-water": async (ctx: Context): Promise<ResetOutcome> => {
    const reason = resetIneligibleReason(ctx.controller.getSnapshot());
    if (reason) throw new CommandError(409, reason);
    if (!canReset(ctx.controller.getSnapshot())) throw new CommandError(409, "reset unavailable");
    ctx.controller.setResetPending(true);
    return await new Promise<ResetOutcome>((resolve) => {
      const timer = setTimeout(() => { unsubscribe(); ctx.controller.setResetPending(false); resolve({ result: "timeout" }); }, ctx.resetTimeoutMs ?? RESET_TIMEOUT_MS);
      const unsubscribe = ctx.device.onResetResult((result) => { clearTimeout(timer); unsubscribe(); resolve({ result: result as ResetResult }); });
      ctx.device.publish(topics(ctx.device.prefix).resetRequest, "ON", { retain: false });
    });
  },
} satisfies Record<string, (ctx: Context, body: never) => unknown>;
