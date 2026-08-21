import { sourceIds, type CommandBodies, type ResetResult, type ScheduleEntry as ScheduleEntryDto, type Zone as ZoneDto } from "@hort/contracts";
import type { DevicePort } from "./ports/device-port";
import type { ControllerSnapshotPort } from "./ports/controller-snapshot";
import { topics } from "./controller-protocol";
import type { Clock } from "../shared-kernel/clock";
import type { IdGenerator } from "../shared-kernel/id-generator";
import { OutputChannel, outputChannels } from "../shared-kernel/output-channel";
import type { DomainError, Result } from "../shared-kernel/result";
import { cycleMode } from "../modules/irrigation/domain/cycle-mode";
import { CycleRecipe } from "../modules/irrigation/domain/cycle-recipe";
import { CycleTarget } from "../modules/irrigation/domain/cycle-target";
import { FlushDuration } from "../modules/irrigation/domain/flush-duration";
import { MinimumFlow } from "../modules/irrigation/domain/minimum-flow";
import { PreWetPercentage } from "../modules/irrigation/domain/pre-wet-percentage";
import type { ScheduleRepository } from "../modules/scheduling/application/schedule-repository";
import { ScheduleBook, SCHEDULE_MAX } from "../modules/scheduling/domain/schedule-book";
import { ScheduleEntry } from "../modules/scheduling/domain/schedule-entry";
import { ScheduleId } from "../modules/scheduling/domain/schedule-id";
import type { WateringEventRepository } from "../modules/watering/application/watering-event-repository";
import type { ZoneRepository } from "../modules/zones/application/zone-repository";
import { AssignmentTable } from "../modules/zones/domain/assignment-table";
import { Zone } from "../modules/zones/domain/zone";
import { ZoneId } from "../modules/zones/domain/zone-id";
import { ZoneName, ZONE_NAME_MAX } from "../modules/zones/domain/zone-name";
import { assignIneligibleReason, canReset, resetIneligibleReason } from "./policies";

export { SCHEDULE_MAX, ZONE_NAME_MAX };

export class CommandError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export type ResetOutcome = { result: ResetResult | "timeout" | "unexpected_response" };
export const RESET_TIMEOUT_MS = 10_000;

export type Context = {
  device: DevicePort;
  controller: ControllerSnapshotPort;
  wateringEvents: WateringEventRepository;
  zones: ZoneRepository;
  schedules: ScheduleRepository;
  clock: Clock;
  ids: IdGenerator;
  resetTimeoutMs?: number;
};

function unwrap<T>(result: Result<T, DomainError>, status = 400): T {
  if (!result.ok) throw new CommandError(status, result.error.message);
  return result.value;
}
const object = (body: unknown): Record<string, unknown> => typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
const isResetResult = (value: string): value is ResetResult => value === "success" || value === "already_zero" || value === "rejected_pump_running" || value === "rejected_flow_active" || value === "rejected_flow_unknown" || value === "error_persistence";
const zoneDto = (zone: Zone): ZoneDto => ({ id: zone.id.toString(), name: zone.name.toString(), archived: zone.archived });
const scheduleDto = (entry: ScheduleEntry): ScheduleEntryDto => ({ id: entry.id.toString(), time: entry.time.toString(), frequency: entry.frequency.toPrimitives(), channel: entry.channel.toNumber(), recipe: entry.recipe.toPrimitives() });

function publishZones(ctx: Context): void { ctx.controller.setZones(ctx.zones.all().map(zoneDto), ctx.zones.currentAssignments().toRecord()); }
function publishSchedules(ctx: Context): void {
  const entries = ctx.schedules.all();
  ctx.controller.setSchedules(entries.map(scheduleDto));
  ctx.device.publish(topics(ctx.device.prefix).scheduleSet, JSON.stringify({ entries: entries.map((entry) => {
    const recipe = entry.recipe.toPrimitives();
    const frequency = entry.frequency.toPrimitives();
    return { id: entry.id.toString(), hour: entry.time.hour, minute: entry.time.minute,
      ...(frequency.kind === "weekdays" ? { mask: frequency.days.reduce((bits, day) => bits | (1 << (day - 1)), 0), every: 0, from: 0 } : { mask: 0, every: frequency.n, from: entry.frequency.anchorEpochDay }),
      channel: entry.channel.toNumber(), volume: recipe.mode === "Volume" ? 1 : 0, total: recipe.total, prewet: recipe.preWetPercent, flush: recipe.flushMinutes };
  }) }), { retain: true });
}

function findZone(ctx: Context, raw: unknown): Zone {
  const id = unwrap(ZoneId.create(raw));
  const zone = ctx.zones.find(id);
  if (!zone) throw new CommandError(404, "unknown zone");
  return zone;
}
function numberValue(body: unknown): unknown { return object(body).value; }
function publishNumber(ctx: Context, firmwareId: string, value: number): void { ctx.device.publish(topics(ctx.device.prefix).numberCommand(firmwareId), String(value)); }

export const handlers = {
  "start-irrigation": (ctx: Context, body: CommandBodies["start-irrigation"]) => {
    const raw = object(body); const channel = unwrap(OutputChannel.create(raw.channel)); const recipe = unwrap(CycleRecipe.create(raw.recipe)); const value = recipe.toPrimitives();
    ctx.device.publish(topics(ctx.device.prefix).irrigationStart, JSON.stringify({ channel: channel.toNumber(), volume: value.mode === "Volume" ? 1 : 0, total: value.total, prewet: value.preWetPercent, flush: value.flushMinutes }));
  },
  "stop-irrigation": (ctx: Context) => { ctx.device.publish(topics(ctx.device.prefix).irrigationStop, "ON"); },
  "toggle-pump": (ctx: Context) => { ctx.device.publish(topics(ctx.device.prefix).switchCommand("pump"), "TOGGLE"); },
  "select-valve": (ctx: Context, body: CommandBodies["select-valve"]) => {
    const valve = object(body).valve;
    if (valve !== "" && (typeof valve !== "string" || !(sourceIds as string[]).includes(valve))) throw new CommandError(400, "invalid valve");
    const t = topics(ctx.device.prefix); for (const id of sourceIds) if (id !== valve) ctx.device.publish(t.switchCommand(id), "OFF"); if (valve) ctx.device.publish(t.switchCommand(String(valve)), "ON");
  },
  "select-output": (ctx: Context, body: CommandBodies["select-output"]) => {
    const raw = object(body).channel; const selected = raw === 0 ? null : unwrap(OutputChannel.create(raw)); const t = topics(ctx.device.prefix);
    for (const channel of outputChannels) if (!selected?.equals(channel)) ctx.device.publish(t.switchCommand(`output_${channel.toNumber()}`), "OFF");
    if (selected) ctx.device.publish(t.switchCommand(`output_${selected.toNumber()}`), "ON");
  },
  "create-zone": (ctx: Context, body: CommandBodies["create-zone"]) => {
    const zone = Zone.create(unwrap(ZoneId.create(ctx.ids.next())), unwrap(ZoneName.create(object(body).name))); ctx.zones.add(zone, ctx.clock.now()); publishZones(ctx); return zoneDto(zone);
  },
  "rename-zone": (ctx: Context, body: CommandBodies["rename-zone"]) => { const raw = object(body); const zone = findZone(ctx, raw.id).rename(unwrap(ZoneName.create(raw.name))); ctx.zones.save(zone); publishZones(ctx); },
  "archive-zone": (ctx: Context, body: CommandBodies["archive-zone"]) => {
    const zone = findZone(ctx, object(body).id); const table = ctx.zones.currentAssignments(); const channel = table.channelFor(zone.id);
    if (channel) { const reason = assignIneligibleReason(ctx.controller.getSnapshot()); if (reason) throw new CommandError(409, reason); }
    ctx.zones.archive(zone.archive(), table.withoutZone(zone.id), ctx.clock.now()); publishZones(ctx);
    if (channel) { ctx.schedules.removeForChannel(channel); publishSchedules(ctx); }
  },
  "unarchive-zone": (ctx: Context, body: CommandBodies["unarchive-zone"]) => { const zone = findZone(ctx, object(body).id).unarchive(); ctx.zones.save(zone); publishZones(ctx); },
  "set-assignments": (ctx: Context, body: CommandBodies["set-assignments"]) => {
    const reason = assignIneligibleReason(ctx.controller.getSnapshot()); if (reason) throw new CommandError(409, reason);
    const live = ctx.zones.all().filter((zone) => !zone.archived).map((zone) => zone.id);
    const table = unwrap(AssignmentTable.create(object(body).assignments, live)); ctx.zones.setAssignments(table, ctx.clock.now()); publishZones(ctx);
  },
  "create-schedule": (ctx: Context, body: CommandBodies["create-schedule"]) => {
    const raw = object(body); const entry = unwrap(ScheduleEntry.create({ id: ctx.ids.next(), time: raw.time, frequency: raw.frequency, channel: raw.channel, recipe: raw.recipe }));
    unwrap(ScheduleBook.rehydrate(ctx.schedules.all()).add(entry), 409); ctx.schedules.save(entry, ctx.clock.now()); publishSchedules(ctx); return scheduleDto(entry);
  },
  "delete-schedule": (ctx: Context, body: CommandBodies["delete-schedule"]) => { ctx.schedules.remove(unwrap(ScheduleId.create(object(body).id))); publishSchedules(ctx); },
  "set-cycle-mode": (ctx: Context, body: CommandBodies["set-cycle-mode"]) => { const mode = unwrap(cycleMode(object(body).mode)); ctx.device.publish(topics(ctx.device.prefix).selectCommand("default_cycle_mode"), mode); },
  "set-pre-wet-percent": (ctx: Context, body: CommandBodies["set-pre-wet-percent"]) => publishNumber(ctx, "default_pre-wet_percent", unwrap(PreWetPercentage.create(numberValue(body))).toNumber()),
  "set-cycle-target": (ctx: Context, body: CommandBodies["set-cycle-target"]) => { const mode = ctx.controller.getSnapshot().entities.default_cycle_mode?.value === "Volume" ? "Volume" : "Time"; const target = unwrap(CycleTarget.create(mode, numberValue(body))); publishNumber(ctx, mode === "Volume" ? "default_cycle_liters" : "default_cycle_minutes", target.toNumber()); },
  "set-flush-duration": (ctx: Context, body: CommandBodies["set-flush-duration"]) => publishNumber(ctx, "default_flush_minutes", unwrap(FlushDuration.create(numberValue(body))).toMinutes()),
  "set-min-flow": (ctx: Context, body: CommandBodies["set-min-flow"]) => publishNumber(ctx, "min_flow", unwrap(MinimumFlow.create(numberValue(body))).toNumber()),
  "reset-total-water": async (ctx: Context): Promise<ResetOutcome> => {
    const reason = resetIneligibleReason(ctx.controller.getSnapshot()); if (reason) throw new CommandError(409, reason); if (!canReset(ctx.controller.getSnapshot())) throw new CommandError(409, "reset unavailable");
    ctx.controller.setResetPending(true);
    return await new Promise<ResetOutcome>((resolve) => { const timer = setTimeout(() => { unsubscribe(); ctx.controller.setResetPending(false); resolve({ result: "timeout" }); }, ctx.resetTimeoutMs ?? RESET_TIMEOUT_MS); const unsubscribe = ctx.device.onResetResult((result) => { clearTimeout(timer); unsubscribe(); resolve({ result: isResetResult(result) ? result : "unexpected_response" }); }); ctx.device.publish(topics(ctx.device.prefix).resetRequest, "ON", { retain: false }); });
  },
} satisfies Record<string, (ctx: Context, body: never) => unknown>;
