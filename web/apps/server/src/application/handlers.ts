import { outputChannels, sourceIds, type CommandBodies, type CycleRecipe, type Frequency, type OutputChannel, type ResetResult } from "@hort/contracts";
import type { Controller } from "../domain/controller";
import type { DevicePort, ScheduleRepository, WateringEventRepository, ZoneRepository } from "../domain/ports";
import { assignIneligibleReason, canReset, inRange, ranges, resetIneligibleReason, type RangeId } from "../domain/policies";
import { topics } from "../domain/topics";

/** Thrown by handlers to signal an HTTP status: 400 invalid body/range, 409 guard failure. */
export class CommandError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export type ResetOutcome = { result: ResetResult | "timeout" };
export const RESET_TIMEOUT_MS = 10_000;

export type Context = { device: DevicePort; controller: Controller; wateringEvents?: WateringEventRepository; zones?: ZoneRepository; schedules?: ScheduleRepository; resetTimeoutMs?: number };

export const ZONE_NAME_MAX = 40;
/** The device holds a fixed-size table; more entries than it can store would silently not fire. */
export const SCHEDULE_MAX = 16;

function zoneRepo(ctx: Context): ZoneRepository {
  if (!ctx.zones) throw new CommandError(409, "zones unavailable");
  return ctx.zones;
}

/** Pushes the registry and the current table into the snapshot (web ADR-0014). */
function publishZones(ctx: Context): void {
  const zones = zoneRepo(ctx);
  ctx.controller.setZones(zones.all(), zones.currentAssignments());
}

function scheduleRepo(ctx: Context): ScheduleRepository {
  if (!ctx.schedules) throw new CommandError(409, "schedules unavailable");
  return ctx.schedules;
}

/** Publishes the entries and pushes them into the snapshot (web ADR-0017). */
function publishSchedules(ctx: Context): void {
  const entries = scheduleRepo(ctx).all();
  ctx.controller.setSchedules(entries);
  // Retained: the controller is usually offline when this changes, and the
  // broker holding the latest set is what makes an edit land on reconnect.
  ctx.device.publish(topics(ctx.device.prefix).scheduleSet, JSON.stringify({ entries: entries.map(wireEntry) }), { retain: true });
}

/** The device's view of an entry: channel and recipe flattened, no zone anywhere. */
function wireEntry(entry: { id: string; time: string; frequency: Frequency; channel: number; recipe: CycleRecipe }) {
  const [hour, minute] = entry.time.split(":").map(Number);
  return {
    id: entry.id,
    hour, minute,
    ...(entry.frequency.kind === "weekdays"
      // A 7-bit mask, bit 0 = Monday: the device tests one bitwise AND per scan.
      ? { mask: entry.frequency.days.reduce((bits, day) => bits | (1 << (day - 1)), 0), every: 0, from: 0 }
      : { mask: 0, every: entry.frequency.n, from: Math.floor(new Date(`${entry.frequency.from}T00:00:00Z`).getTime() / 86_400_000) }),
    channel: entry.channel,
    volume: entry.recipe.mode === "Volume" ? 1 : 0,
    total: entry.recipe.total,
    prewet: entry.recipe.preWetPercent,
    flush: entry.recipe.flushMinutes,
  };
}

function cycleRecipe(body: unknown): CycleRecipe {
  const raw = (body as { recipe?: unknown })?.recipe;
  if (typeof raw !== "object" || raw === null) throw new CommandError(400, "recipe must be an object");
  const { mode, total, preWetPercent, flushMinutes } = raw as Record<string, unknown>;
  if (mode !== "Time" && mode !== "Volume") throw new CommandError(400, "invalid cycle mode");
  const id: RangeId = mode === "Volume" ? "cycle_liters" : "cycle_minutes";
  for (const [name, value, range] of [["total", total, id], ["preWetPercent", preWetPercent, "pre-wet_percent"], ["flushMinutes", flushMinutes, "flush_minutes"]] as Array<[string, unknown, RangeId]>) {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new CommandError(400, `${name} must be a finite number`);
    if (!inRange(range, value)) throw new CommandError(400, `${name} out of range [${ranges[range].min}, ${ranges[range].max}]`);
  }
  return { mode, total: total as number, preWetPercent: preWetPercent as number, flushMinutes: flushMinutes as number };
}

/** `HH:MM` on a 24-hour clock. Anything else would fire at an hour nobody chose. */
function timeOfDay(body: unknown): string {
  const time = (body as { time?: unknown })?.time;
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new CommandError(400, "time must be HH:MM");
  return time;
}

/**
 * Weekday mask or every-N-days, never both (controller ADR-0018). An empty
 * weekday set is refused rather than stored: it fires on no day, so it is an
 * entry that looks scheduled and never waters.
 */
function frequency(body: unknown): Frequency {
  const raw = (body as { frequency?: unknown })?.frequency;
  if (typeof raw !== "object" || raw === null) throw new CommandError(400, "frequency must be an object");
  const value = raw as Record<string, unknown>;
  if (value.kind === "weekdays") {
    const days = value.days;
    if (!Array.isArray(days) || days.length === 0) throw new CommandError(400, "choose at least one day");
    if (!days.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)) throw new CommandError(400, "days must be 1-7");
    return { kind: "weekdays", days: [...new Set(days as number[])].sort((a, b) => a - b) };
  }
  if (value.kind === "everyN") {
    const { n, from } = value;
    if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > 90) throw new CommandError(400, "n must be 1-90");
    if (typeof from !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(from) || Number.isNaN(new Date(`${from}T00:00:00Z`).getTime())) throw new CommandError(400, "from must be YYYY-MM-DD");
    return { kind: "everyN", n: n as number, from };
  }
  throw new CommandError(400, "unknown frequency kind");
}

function outputChannel(body: unknown): OutputChannel {
  const channel = (body as { channel?: unknown })?.channel;
  if (!(outputChannels as readonly number[]).includes(channel as number)) throw new CommandError(400, "invalid output channel");
  return channel as OutputChannel;
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
  /**
   * Channel and recipe both travel with the start (controller ADR-0017,
   * ADR-0018), so both are required and neither falls back to device state.
   */
  "start-irrigation": (ctx: Context, body: CommandBodies["start-irrigation"]) => {
    const channel = outputChannel(body);
    const recipe = cycleRecipe(body);
    ctx.device.publish(topics(ctx.device.prefix).irrigationStart, JSON.stringify({ channel, volume: recipe.mode === "Volume" ? 1 : 0, total: recipe.total, prewet: recipe.preWetPercent, flush: recipe.flushMinutes }));
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
  /**
   * Archiving takes the zone's schedules with it: an archived zone is out of
   * service, and entries left behind would keep watering it on the channel it
   * used to sit on, with nothing on screen naming them.
   */
  "archive-zone": (ctx: Context, body: CommandBodies["archive-zone"]) => {
    const id = zoneId(ctx, body);
    const channel = Object.entries(zoneRepo(ctx).currentAssignments()).find(([, zone]) => zone === id)?.[0];
    zoneRepo(ctx).archive(id);
    publishZones(ctx);
    if (channel && ctx.schedules) { ctx.schedules.removeForChannel(Number(channel)); publishSchedules(ctx); }
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
  "create-schedule": (ctx: Context, body: CommandBodies["create-schedule"]) => {
    const repo = scheduleRepo(ctx);
    if (repo.all().length >= SCHEDULE_MAX) throw new CommandError(409, `at most ${SCHEDULE_MAX} schedules`);
    const entry = repo.create({ time: timeOfDay(body), frequency: frequency(body), channel: outputChannel(body), recipe: cycleRecipe(body) });
    publishSchedules(ctx);
    return entry;
  },
  "delete-schedule": (ctx: Context, body: CommandBodies["delete-schedule"]) => {
    const id = (body as { id?: unknown })?.id;
    if (typeof id !== "string" || !id) throw new CommandError(400, "invalid schedule id");
    scheduleRepo(ctx).remove(id);
    publishSchedules(ctx);
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
