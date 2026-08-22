import { beforeEach, describe, expect, test } from "bun:test";
import { openDatabase, type Db } from "../../../../infrastructure/db/database";
import { AssignmentTable } from "../../../zones/domain/assignment-table";
import { Zone } from "../../../zones/domain/zone";
import { ZoneId } from "../../../zones/domain/zone-id";
import { ZoneName } from "../../../zones/domain/zone-name";
import { DrizzleZoneRepository } from "../../../zones/infrastructure/drizzle-zone-repository";
import { WateringEvent } from "../../domain/watering-event";
import { DrizzleWateringEventRepository } from "../../infrastructure/drizzle-watering-event-repository";
import type { WateringQueryContext } from "./context";
import { getWateringEvents } from "./get-watering-events";

const at = (iso: string) => new Date(iso);

describe("get-watering-events", () => {
  let db: Db;
  let zones: DrizzleZoneRepository;
  let events: DrizzleWateringEventRepository;
  let ctx: WateringQueryContext;

  beforeEach(() => {
    db = openDatabase(":memory:");
    zones = new DrizzleZoneRepository(db);
    events = new DrizzleWateringEventRepository(db, zones);
    ctx = { zones, wateringEvents: events };
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
  const ingest = (seq: number, outputChannel: number | null, endedAt: string | null) => events.ingest([
    WateringEvent.rehydrate({
      deviceId: "kc868-a8",
      seq,
      startedAt: endedAt ? at(endedAt) : null,
      endedAt: endedAt ? at(endedAt) : null,
      litresDelivered: 10,
      outcome: "completed",
      trigger: "sequence",
      outputChannel,
    }),
  ]);

  test("uses the current zone name without changing historical identity", () => {
    const zone = createZone("Tomato patch");
    assign({ 1: zone.id.toString() }, at("2026-01-01T00:00:00Z"));
    ingest(1, 1, "2026-02-01T00:00:00Z");
    zones.save(zone.rename(ZoneName.rehydrate("Vegetable beds")));
    expect(getWateringEvents(ctx)[0]).toMatchObject({ zoneId: zone.id.toString(), zoneName: "Vegetable beds" });
  });

  test("keeps an archived zone attached to what it watered", () => {
    const zone = createZone("Vegetable beds");
    assign({ 1: zone.id.toString() }, at("2026-01-01T00:00:00Z"));
    ingest(1, 1, "2026-02-01T00:00:00Z");
    zones.archive(zone.archive(), zones.currentAssignments().withoutZone(zone.id), at("2026-03-01T00:00:00Z"));
    expect(getWateringEvents(ctx)[0]).toMatchObject({ zoneId: zone.id.toString(), zoneName: "Vegetable beds" });
  });

  test("resolves an event against the assignment active when it ran", () => {
    const olive = createZone("Olive terrace");
    const almond = createZone("Almond row");
    assign({ 2: olive.id.toString() }, at("2026-01-01T00:00:00Z"));
    assign({ 2: almond.id.toString() }, at("2026-05-01T00:00:00Z"));
    ingest(1, 2, "2026-03-03T06:00:00Z");
    ingest(2, 2, "2026-06-03T06:00:00Z");
    const [june, march] = getWateringEvents(ctx);
    expect(march?.zoneName).toBe("Olive terrace");
    expect(june?.zoneName).toBe("Almond row");
  });

  test("uses the current assignment when the device has no clock", () => {
    const zone = createZone("Young trees");
    assign({ 3: zone.id.toString() });
    ingest(9, 3, null);
    expect(getWateringEvents(ctx)[0]?.zoneName).toBe("Young trees");
  });

  test("leaves an unassigned channel without a zone", () => {
    ingest(1, 4, "2026-02-01T00:00:00Z");
    expect(getWateringEvents(ctx)[0]).toMatchObject({ outputChannel: 4, zoneId: null, zoneName: null });
  });
});
