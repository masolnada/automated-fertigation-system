import { beforeEach, describe, expect, test } from "bun:test";
import { openDatabase, type Db } from "../src/infrastructure/db/database";
import { DrizzleWateringEventRepository } from "../src/modules/watering/infrastructure/drizzle-watering-event-repository";
import { DrizzleZoneRepository } from "../src/modules/zones/infrastructure/drizzle-zone-repository";
import { DrizzleScheduleRepository } from "../src/modules/scheduling/infrastructure/drizzle-schedule-repository";
import { dispatchCommand, getWateringEvents } from "../src/application/dispatch";
import { ControllerSnapshotProjection } from "../src/infrastructure/projections/controller-snapshot-projection";
import { CommandError, type Context } from "../src/application/handlers";
import { SystemClock } from "../src/shared-kernel/clock";
import { UuidGenerator } from "../src/shared-kernel/id-generator";
import { OutputChannel } from "../src/shared-kernel/output-channel";
import { AssignmentTable } from "../src/modules/zones/domain/assignment-table";
import { Zone } from "../src/modules/zones/domain/zone";
import { ZoneId } from "../src/modules/zones/domain/zone-id";
import { ZoneName } from "../src/modules/zones/domain/zone-name";
import { WateringEvent } from "../src/modules/watering/domain/watering-event";

let db: Db;
let zones: DrizzleZoneRepository;
let events: DrizzleWateringEventRepository;
let controller: ControllerSnapshotProjection;
let ctx: Context;
let published: Array<{ topic: string; payload: string }>;
const at = (iso: string) => new Date(iso);

beforeEach(() => {
  db = openDatabase(":memory:"); zones = new DrizzleZoneRepository(db); events = new DrizzleWateringEventRepository(db, zones); controller = new ControllerSnapshotProjection(); published = [];
  ctx = { controller, zones, wateringEvents: events, schedules: new DrizzleScheduleRepository(db), clock: new SystemClock(), ids: new UuidGenerator(), device: { prefix: "kc868-a8", publish: (topic, payload) => { published.push({ topic, payload }); }, onResetResult: () => () => {}, onWateringLog: () => () => {} } };
});

const ingest = (seq: number, outputChannel: number | null, endedAt: string | null) => events.ingest([WateringEvent.rehydrate({ deviceId: "kc868-a8", seq, startedAt: endedAt ? at(endedAt) : null, endedAt: endedAt ? at(endedAt) : null, litresDelivered: 10, outcome: "completed", trigger: "sequence", outputChannel })]);
const createZone = (name: string) => { const zone = Zone.create(ZoneId.rehydrate(crypto.randomUUID()), ZoneName.rehydrate(name)); zones.add(zone, new Date()); return { id: zone.id.toString(), name: zone.name.toString(), archived: false }; };
const assign = (raw: Record<number, string | null>, when = new Date()) => { const live = zones.all().filter((zone) => !zone.archived).map((zone) => zone.id); const table = AssignmentTable.create(raw, live); if (!table.ok) throw table.error; zones.setAssignments(table.value, when); };
const rename = (id: string, name: string) => { const zoneId = ZoneId.rehydrate(id); zones.save(zones.find(zoneId)!.rename(ZoneName.rehydrate(name))); };
const archive = (id: string, when = new Date()) => { const zoneId = ZoneId.rehydrate(id); zones.archive(zones.find(zoneId)!.archive(), zones.currentAssignments().withoutZone(zoneId), when); };
const unarchive = (id: string) => { const zoneId = ZoneId.rehydrate(id); zones.save(zones.find(zoneId)!.unarchive()); };
const wireEvents = () => getWateringEvents(ctx);

describe("zone registry", () => {
  test("a created zone is live, unassigned and identified by id, not name", () => {
    const first = createZone("Olive terrace"), second = createZone("Olive terrace");
    expect(first.id).not.toBe(second.id);
    expect(zones.all().map((zone) => zone.name.toString())).toEqual(["Olive terrace", "Olive terrace"]);
    expect(zones.all().map((zone) => zone.archived)).toEqual([false, false]);
    expect(zones.currentAssignments().toRecord()).toEqual({});
  });
  test("renaming keeps identity, so history reads under the new name", () => {
    const zone = createZone("Tomato patch"); assign({ 1: zone.id }, at("2026-01-01T00:00:00Z")); ingest(1, 1, "2026-02-01T00:00:00Z"); rename(zone.id, "Vegetable beds");
    expect(wireEvents()[0]!.zoneName).toBe("Vegetable beds"); expect(wireEvents()[0]!.zoneId).toBe(zone.id);
  });
  test("archiving clears the assignment but preserves what it watered", () => {
    const zone = createZone("Vegetable beds"); assign({ 1: zone.id }, at("2026-01-01T00:00:00Z")); ingest(1, 1, "2026-02-01T00:00:00Z"); archive(zone.id, at("2026-03-01T00:00:00Z"));
    expect(zones.currentAssignments().toRecord()).toEqual({}); expect(zones.all()[0]!.archived).toBe(true); expect(wireEvents()[0]).toMatchObject({ zoneId: zone.id, zoneName: "Vegetable beds" });
  });
  test("unarchiving restores the zone but not its assignment", () => {
    const zone = createZone("Herb strip"); assign({ 2: zone.id }); archive(zone.id); unarchive(zone.id);
    expect(zones.all()[0]!.archived).toBe(false); expect(zones.currentAssignments().toRecord()).toEqual({});
  });
});

describe("temporal assignment", () => {
  test("an event resolves to the zone on its channel when it ran, not now", () => {
    const olive = createZone("Olive terrace"), almond = createZone("Almond row"); assign({ 2: olive.id }, at("2026-01-01T00:00:00Z")); assign({ 2: almond.id }, at("2026-05-01T00:00:00Z")); ingest(1, 2, "2026-03-03T06:00:00Z"); ingest(2, 2, "2026-06-03T06:00:00Z");
    const [june, march] = wireEvents(); expect(march!.zoneName).toBe("Olive terrace"); expect(june!.zoneName).toBe("Almond row");
  });
  test("an event with no clock falls back to the current assignment", () => { const zone = createZone("Young trees"); assign({ 3: zone.id }); ingest(9, 3, null); expect(wireEvents()[0]!.zoneName).toBe("Young trees"); });
  test("watering an unassigned channel records no zone", () => { ingest(1, 4, "2026-02-01T00:00:00Z"); expect(wireEvents()[0]).toMatchObject({ outputChannel: 4, zoneId: null, zoneName: null }); });
  test("only changed channels are written, under one shared valid_from", () => {
    const olive = createZone("Olive terrace"), almond = createZone("Almond row"); assign({ 1: olive.id, 2: almond.id }, at("2026-01-01T00:00:00Z")); assign({ 1: olive.id, 2: null }, at("2026-02-01T00:00:00Z"));
    expect(zones.zoneAt(OutputChannel.rehydrate(1), at("2026-01-15T00:00:00Z"))?.toString()).toBe(olive.id);
    expect(zones.zoneAt(OutputChannel.rehydrate(2), at("2026-01-15T00:00:00Z"))?.toString()).toBe(almond.id);
    expect(zones.zoneAt(OutputChannel.rehydrate(2), at("2026-03-01T00:00:00Z"))).toBeNull();
  });
});

describe("assignment commands", () => {
  const dispatch = (name: string, body: unknown) => dispatchCommand(ctx, name, body);
  const live = () => ctx.controller.getSnapshot();
  test("saving the table publishes zones and assignments into the snapshot", () => { const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string }; dispatch("set-assignments", { assignments: { 1: zone.id, 2: null, 3: null, 4: null } }); expect(live().zones.map((z) => z.name)).toEqual(["Olive terrace"]); expect(live().assignments).toEqual({ 1: zone.id }); });
  test("one zone on two channels is refused as a whole", () => { const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string }; expect(() => dispatch("set-assignments", { assignments: { 1: zone.id, 2: zone.id } })).toThrow(CommandError); expect(zones.currentAssignments().toRecord()).toEqual({}); });
  test("an archived zone cannot be assigned", () => { const zone = dispatch("create-zone", { name: "Tomato patch" }) as { id: string }; dispatch("archive-zone", { id: zone.id }); expect(() => dispatch("set-assignments", { assignments: { 1: zone.id } })).toThrow(CommandError); });
  test("editing and archive-induced clearing are refused while the pump runs", () => {
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string }; dispatch("set-assignments", { assignments: { 1: zone.id } }); controller.message("kc868-a8", "kc868-a8/switch/pump/state", "ON");
    expect(() => dispatch("set-assignments", { assignments: { 2: zone.id } })).toThrow("Stop the pump to edit assignments"); expect(() => dispatch("archive-zone", { id: zone.id })).toThrow("Stop the pump to edit assignments"); expect(zones.currentAssignments().toRecord()).toEqual({ 1: zone.id });
  });
  test("selecting an output channel shuts the others", () => { dispatch("select-output", { channel: 2 }); expect(published).toEqual([{ topic: "kc868-a8/switch/output_1/command", payload: "OFF" }, { topic: "kc868-a8/switch/output_3/command", payload: "OFF" }, { topic: "kc868-a8/switch/output_4/command", payload: "OFF" }, { topic: "kc868-a8/switch/output_2/command", payload: "ON" }]); });
  test("an unknown zone id is rejected rather than silently ignored", () => { const id = crypto.randomUUID(); expect(() => dispatch("rename-zone", { id, name: "X" })).toThrow(CommandError); expect(() => dispatch("archive-zone", { id })).toThrow(CommandError); });
  test("a blank or oversized name is rejected", () => { expect(() => dispatch("create-zone", { name: "  " })).toThrow(CommandError); expect(() => dispatch("create-zone", { name: "x".repeat(41) })).toThrow(CommandError); });
});
