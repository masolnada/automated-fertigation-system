import type { ResetResult } from "@hort/contracts";
import type { ScheduleRepository } from "../modules/scheduling/application/schedule-repository";
import type { WateringEventRepository } from "../modules/watering/application/watering-event-repository";
import type { ZoneRepository } from "../modules/zones/application/zone-repository";
import type { Clock } from "../shared-kernel/clock";
import type { IdGenerator } from "../shared-kernel/id-generator";
import type { DomainError, Result } from "../shared-kernel/result";
import type { ControllerSnapshotPort } from "./ports/controller-snapshot";
import type { DevicePort } from "./ports/device-port";

export class CommandError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export type ResetOutcome = { result: ResetResult | "timeout" | "unexpected_response" };

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

export function unwrap<T>(result: Result<T, DomainError>, status = 400): T {
  if (!result.ok) throw new CommandError(status, result.error.message);
  return result.value;
}

export const commandBody = (body: unknown): Record<string, unknown> =>
  typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
