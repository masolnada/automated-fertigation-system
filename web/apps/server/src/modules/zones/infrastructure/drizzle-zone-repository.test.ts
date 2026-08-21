import { beforeEach, describe, expect, test } from "bun:test";
import { openDatabase } from "../../../infrastructure/db/database";
import { OutputChannel } from "../../../shared-kernel/output-channel";
import { AssignmentTable } from "../domain/assignment-table";
import { Zone } from "../domain/zone";
import { ZoneId } from "../domain/zone-id";
import { ZoneName } from "../domain/zone-name";
import { DrizzleZoneRepository } from "./drizzle-zone-repository";

const at = (iso: string) => new Date(iso);

describe("DrizzleZoneRepository", () => {
  let zones: DrizzleZoneRepository;

  beforeEach(() => {
    zones = new DrizzleZoneRepository(openDatabase(":memory:"));
  });

  const createZone = (name: string) => {
    const zone = Zone.create(ZoneId.rehydrate(crypto.randomUUID()), ZoneName.rehydrate(name));
    zones.add(zone, new Date());
    return zone;
  };
  const assign = (raw: Record<number, string | null>, when = new Date()) => {
    const live = zones.all().filter((zone) => !zone.archived).map((zone) => zone.id);
    const table = AssignmentTable.create(raw, live);
    if (!table.ok) throw table.error;
    zones.setAssignments(table.value, when);
  };

  test("stores zones by identity rather than name", () => {
    const first = createZone("Olive terrace");
    const second = createZone("Olive terrace");
    expect(first.id.equals(second.id)).toBe(false);
    expect(zones.all().map((zone) => zone.name.toString())).toEqual(["Olive terrace", "Olive terrace"]);
    expect(zones.all().map((zone) => zone.archived)).toEqual([false, false]);
    expect(zones.currentAssignments().toRecord()).toEqual({});
  });

  test("persists rename, archive and unarchive transitions", () => {
    const zone = createZone("Herb strip");
    zones.save(zone.rename(ZoneName.rehydrate("Herbs")));
    assign({ 2: zone.id.toString() });
    zones.archive(zones.find(zone.id)!.archive(), zones.currentAssignments().withoutZone(zone.id), new Date());
    expect(zones.find(zone.id)).toMatchObject({ archived: true });
    expect(zones.find(zone.id)?.name.toString()).toBe("Herbs");
    expect(zones.currentAssignments().toRecord()).toEqual({});
    zones.save(zones.find(zone.id)!.unarchive());
    expect(zones.find(zone.id)?.archived).toBe(false);
    expect(zones.currentAssignments().toRecord()).toEqual({});
  });

  test("resolves the zone assigned to a channel at a point in time", () => {
    const olive = createZone("Olive terrace");
    const almond = createZone("Almond row");
    assign({ 2: olive.id.toString() }, at("2026-01-01T00:00:00Z"));
    assign({ 2: almond.id.toString() }, at("2026-05-01T00:00:00Z"));
    expect(zones.zoneAt(OutputChannel.rehydrate(2), at("2026-03-03T06:00:00Z"))?.equals(olive.id)).toBe(true);
    expect(zones.zoneAt(OutputChannel.rehydrate(2), at("2026-06-03T06:00:00Z"))?.equals(almond.id)).toBe(true);
    expect(zones.zoneAt(OutputChannel.rehydrate(2), null)?.equals(almond.id)).toBe(true);
  });

  test("writes only changed channels under the new effective time", () => {
    const olive = createZone("Olive terrace");
    const almond = createZone("Almond row");
    assign({ 1: olive.id.toString(), 2: almond.id.toString() }, at("2026-01-01T00:00:00Z"));
    assign({ 1: olive.id.toString(), 2: null }, at("2026-02-01T00:00:00Z"));
    expect(zones.zoneAt(OutputChannel.rehydrate(1), at("2026-01-15T00:00:00Z"))?.equals(olive.id)).toBe(true);
    expect(zones.zoneAt(OutputChannel.rehydrate(2), at("2026-01-15T00:00:00Z"))?.equals(almond.id)).toBe(true);
    expect(zones.zoneAt(OutputChannel.rehydrate(2), at("2026-03-01T00:00:00Z"))).toBeNull();
  });
});
