import { outputChannels, sourceIds, type CommandBodies, type ResetResult } from "@hort/contracts";
import type { Controller } from "../domain/controller";
import type { DevicePort, WateringEventRepository, ZoneRepository } from "../domain/ports";
import { assignIneligibleReason, canReset, inRange, ranges, resetIneligibleReason, type RangeId } from "../domain/policies";
import { topics } from "../domain/topics";

/** Thrown by handlers to signal an HTTP status: 400 invalid body/range, 409 guard failure. */
export class CommandError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export type ResetOutcome = { result: ResetResult | "timeout" };
export const RESET_TIMEOUT_MS = 10_000;

export type Context = { device: DevicePort; controller: Controller; wateringEvents?: WateringEventRepository; zones?: ZoneRepository; resetTimeoutMs?: number };

export const ZONE_NAME_MAX = 40;

function zoneRepo(ctx: Context): ZoneRepository {
  if (!ctx.zones) throw new CommandError(409, "zones unavailable");
  return ctx.zones;
}

/** Pushes the registry and the current table into the snapshot (web ADR-0014). */
function publishZones(ctx: Context): void {
  const zones = zoneRepo(ctx);
  ctx.controller.setZones(zones.all(), zones.currentAssignments());
}

function zoneName(body: unknown): string {
  const name = typeof (body as { name?: unknown })?.name === "string" ? (body as { name: string }).name.trim() : "";
  if (!name) throw new CommandError(400, "name must not be empty");
  if (name.length > ZONE_NAME_MAX) throw new CommandError(400, `name must be at most ${ZONE_NAME_MAX} characters`);
  return name;
}

function zoneId(ctx: Context, body: unknown): string {
  const id = (body as { id?: unknown })?.id;
  if (typeof id !== "string" || !id) throw new CommandError(400, "invalid zone id");
  if (!zoneRepo(ctx).all().some((zone) => zone.id === id)) throw new CommandError(404, "unknown zone");
  return id;
}

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
  /** The channel travels with the start (controller ADR-0017), so it is required. */
  "start-irrigation": (ctx: Context, body: CommandBodies["start-irrigation"]) => {
    const channel = body?.channel;
    if (!(outputChannels as readonly number[]).includes(channel)) throw new CommandError(400, "invalid output channel");
    ctx.device.publish(topics(ctx.device.prefix).irrigationStart, String(channel));
  },
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
  "select-output": (ctx: Context, body: CommandBodies["select-output"]) => {
    const channel = body?.channel;
    if (!Number.isInteger(channel) || (channel !== 0 && !(outputChannels as readonly number[]).includes(channel))) throw new CommandError(400, "invalid output channel");
    const t = topics(ctx.device.prefix);
    for (const n of outputChannels) if (n !== channel) ctx.device.publish(t.switchCommand(`output_${n}`), "OFF");
    if (channel) ctx.device.publish(t.switchCommand(`output_${channel}`), "ON");
  },
  "create-zone": (ctx: Context, body: CommandBodies["create-zone"]) => {
    const zone = zoneRepo(ctx).create(zoneName(body));
    publishZones(ctx);
    return zone;
  },
  "rename-zone": (ctx: Context, body: CommandBodies["rename-zone"]) => {
    zoneRepo(ctx).rename(zoneId(ctx, body), zoneName(body));
    publishZones(ctx);
  },
  "archive-zone": (ctx: Context, body: CommandBodies["archive-zone"]) => {
    zoneRepo(ctx).archive(zoneId(ctx, body));
    publishZones(ctx);
  },
  "unarchive-zone": (ctx: Context, body: CommandBodies["unarchive-zone"]) => {
    zoneRepo(ctx).unarchive(zoneId(ctx, body));
    publishZones(ctx);
  },
  /**
   * The whole table at once (web ADR-0014). Refused while the pump runs:
   * reassigning mid-run would split one pump-on span across two zones, which the
   * temporal resolution cannot express.
   */
  "set-assignments": (ctx: Context, body: CommandBodies["set-assignments"]) => {
    const repo = zoneRepo(ctx);
    const reason = assignIneligibleReason(ctx.controller.getSnapshot());
    if (reason) throw new CommandError(409, reason);
    const raw = body?.assignments;
    if (typeof raw !== "object" || raw === null) throw new CommandError(400, "assignments must be an object");

    const live = new Set(repo.all().filter((zone) => !zone.archived).map((zone) => zone.id));
    const next: Record<number, string | null> = {};
    const seen = new Set<string>();
    for (const channel of outputChannels) {
      const value = (raw as Record<number, unknown>)[channel] ?? null;
      if (value === null || value === "") { next[channel] = null; continue; }
      if (typeof value !== "string" || !live.has(value)) throw new CommandError(400, `invalid zone for output ${channel}`);
      // One-to-one is a table-level invariant, so it is checked over the table.
      if (seen.has(value)) throw new CommandError(400, "a zone can be assigned to only one output channel");
      seen.add(value);
      next[channel] = value;
    }
    for (const key of Object.keys(raw)) if (!(outputChannels as readonly number[]).includes(Number(key))) throw new CommandError(400, `unknown output channel ${key}`);

    repo.setAssignments(next);
    publishZones(ctx);
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
