import { OutputChannel, outputChannels } from "../../../shared-kernel/output-channel";
import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { ValueObject } from "../../../shared-kernel/value-object";
import { ZoneId } from "./zone-id";

export class AssignmentTable extends ValueObject {
  private constructor(private readonly assignments: ReadonlyMap<number, ZoneId>) { super(); }

  static create(raw: unknown, liveZoneIds: readonly ZoneId[]): Result<AssignmentTable> {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return err(new DomainError("invalid_assignments", "assignments must be an object"));
    const record = raw as Record<string, unknown>;
    for (const key of Object.keys(record)) if (!outputChannels.some((channel) => channel.toNumber() === Number(key))) return err(new DomainError("invalid_assignments", `unknown output channel ${key}`));
    const live = new Map(liveZoneIds.map((id) => [id.toString(), id]));
    const seen = new Set<string>();
    const assignments = new Map<number, ZoneId>();
    for (const channel of outputChannels) {
      const value = record[String(channel.toNumber())] ?? null;
      if (value === null || value === "") continue;
      if (typeof value !== "string" || !live.has(value)) return err(new DomainError("invalid_assignments", `invalid zone for output ${channel.toNumber()}`));
      if (seen.has(value)) return err(new DomainError("duplicate_zone_assignment", "a zone can be assigned to only one output channel"));
      seen.add(value);
      assignments.set(channel.toNumber(), live.get(value)!);
    }
    return ok(new AssignmentTable(assignments));
  }

  static rehydrate(entries: ReadonlyArray<readonly [OutputChannel, ZoneId | null]>): AssignmentTable {
    const assignments = new Map<number, ZoneId>();
    const seen = new Set<string>();
    for (const [channel, zone] of entries) {
      if (!zone) { assignments.delete(channel.toNumber()); continue; }
      if (seen.has(zone.toString())) throw new DomainError("invalid_persisted_assignments", "a zone can be assigned to only one output channel");
      seen.add(zone.toString()); assignments.set(channel.toNumber(), zone);
    }
    return new AssignmentTable(assignments);
  }

  zoneOn(channel: OutputChannel): ZoneId | null { return this.assignments.get(channel.toNumber()) ?? null; }
  channelFor(zoneId: ZoneId): OutputChannel | null {
    const entry = [...this.assignments.entries()].find(([, assigned]) => assigned.equals(zoneId));
    return entry ? OutputChannel.rehydrate(entry[0]) : null;
  }
  withoutZone(zoneId: ZoneId): AssignmentTable { return new AssignmentTable(new Map([...this.assignments].filter(([, assigned]) => !assigned.equals(zoneId)))); }
  toRecord(): Record<number, string> { return Object.fromEntries([...this.assignments].map(([channel, zone]) => [channel, zone.toString()])); }
  entries(): Array<readonly [OutputChannel, ZoneId | null]> { return outputChannels.map((channel) => [channel, this.zoneOn(channel)] as const); }
  protected equalityComponents(): readonly unknown[] { return outputChannels.flatMap((channel) => [channel.toNumber(), this.zoneOn(channel)?.toString() ?? null]); }
}
