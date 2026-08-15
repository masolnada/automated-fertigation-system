import { beforeEach, describe, expect, test } from "bun:test";
import { openDatabase } from "../src/infrastructure/db/database";
import { DrizzleWateringEventRepository } from "../src/infrastructure/db/watering-repository";
import { DrizzleZoneRepository } from "../src/infrastructure/db/zone-repository";
import { dispatchCommand } from "../src/application/dispatch";
import { Controller } from "../src/domain/controller";
import { CommandError, type Context } from "../src/application/handlers";
import type { Db } from "../src/infrastructure/db/database";

let db: Db;
let zones: DrizzleZoneRepository;
let events: DrizzleWateringEventRepository;
let ctx: Context;
let published: Array<{ topic: string; payload: string }>;

const at = (iso: string) => new Date(iso);

beforeEach(() => {
  db = openDatabase(":memory:");
  zones = new DrizzleZoneRepository(db);
  events = new DrizzleWateringEventRepository(db, zones);
  published = [];
  ctx = {
    controller: new Controller(),
    zones,
    wateringEvents: events,
    device: { prefix: "kc868-a8", publish: (topic, payload) => { published.push({ topic, payload }); }, onResetResult: () => () => {}, onWateringLog: () => () => {} },
  };
});

const ingest = (seq: number, outputChannel: number | null, endedAt: string) =>
  events.ingest([{ deviceId: "kc868-a8", seq, startedAt: at(endedAt), endedAt: at(endedAt), litresDelivered: 10, outcome: "completed", trigger: "sequence", outputChannel }]);

describe("zone registry", () => {
  test("a created zone is live, unassigned and identified by id, not name", () => {
    const first = zones.create("Olive terrace");
    const second = zones.create("Olive terrace");
    expect(first.id).not.toBe(second.id);
    expect(zones.all().map((zone) => zone.archived)).toEqual([false, false]);
    expect(zones.currentAssignments()).toEqual({});
  });

  test("renaming keeps identity, so history reads under the new name", () => {
    const zone = zones.create("Tomato patch");
    zones.setAssignments({ 1: zone.id }, at("2026-01-01T00:00:00Z"));
    ingest(1, 1, "2026-02-01T00:00:00Z");
    zones.rename(zone.id, "Vegetable beds");
    // Names are current-only (web ADR-0015): the old event relabels too.
    expect(events.recent(10)[0]!.zoneName).toBe("Vegetable beds");
    expect(events.recent(10)[0]!.zoneId).toBe(zone.id);
  });

  test("archiving clears the assignment but preserves what it watered", () => {
    const zone = zones.create("Vegetable beds");
    zones.setAssignments({ 1: zone.id }, at("2026-01-01T00:00:00Z"));
    ingest(1, 1, "2026-02-01T00:00:00Z");
    zones.archive(zone.id, at("2026-03-01T00:00:00Z"));

    expect(zones.currentAssignments()).toEqual({});
    expect(zones.all()[0]!.archived).toBe(true);
    const event = events.recent(10)[0]!;
    expect(event.zoneId).toBe(zone.id);
    expect(event.zoneName).toBe("Vegetable beds");
  });

  test("unarchiving restores the zone but not its assignment", () => {
    const zone = zones.create("Herb strip");
    zones.setAssignments({ 2: zone.id });
    zones.archive(zone.id);
    zones.unarchive(zone.id);
    expect(zones.all()[0]!.archived).toBe(false);
    expect(zones.currentAssignments()).toEqual({});
  });
});

describe("temporal assignment", () => {
  // The whole reason the table is append-only (web ADR-0014): the controller is
  // offline for weeks, so events are ingested long after they ran.
  test("an event resolves to the zone on its channel when it ran, not now", () => {
    const olive = zones.create("Olive terrace");
    const almond = zones.create("Almond row");
    zones.setAssignments({ 2: olive.id }, at("2026-01-01T00:00:00Z"));
    // Two months of watering, ingested only after the pipe was moved.
    zones.setAssignments({ 2: almond.id }, at("2026-05-01T00:00:00Z"));
    ingest(1, 2, "2026-03-03T06:00:00Z");
    ingest(2, 2, "2026-06-03T06:00:00Z");

    const [june, march] = events.recent(10);
    expect(march!.zoneName).toBe("Olive terrace");
    expect(june!.zoneName).toBe("Almond row");
  });

  test("an event with no clock falls back to the current assignment", () => {
    const zone = zones.create("Young trees");
    zones.setAssignments({ 3: zone.id });
    events.ingest([{ deviceId: "kc868-a8", seq: 9, startedAt: null, endedAt: null, litresDelivered: 4, outcome: "completed", trigger: "manual", outputChannel: 3 }]);
    expect(events.recent(10)[0]!.zoneName).toBe("Young trees");
  });

  // An unassigned channel still waters; the manual button works with no server
  // at all, so the event simply records no zone.
  test("watering an unassigned channel records no zone", () => {
    ingest(1, 4, "2026-02-01T00:00:00Z");
    const event = events.recent(10)[0]!;
    expect(event.outputChannel).toBe(4);
    expect(event.zoneId).toBeNull();
    expect(event.zoneName).toBeNull();
  });

  test("only changed channels are written, under one shared valid_from", () => {
    const olive = zones.create("Olive terrace");
    const almond = zones.create("Almond row");
    zones.setAssignments({ 1: olive.id, 2: almond.id }, at("2026-01-01T00:00:00Z"));
    zones.setAssignments({ 1: olive.id, 2: null }, at("2026-02-01T00:00:00Z"));
    // Channel 1 was unchanged, so it kept its original row.
    expect(zones.zoneAt(1, at("2026-01-15T00:00:00Z"))).toBe(olive.id);
    expect(zones.zoneAt(2, at("2026-01-15T00:00:00Z"))).toBe(almond.id);
    expect(zones.zoneAt(2, at("2026-03-01T00:00:00Z"))).toBeNull();
  });
});

describe("assignment commands", () => {
  const dispatch = (name: string, body: unknown) => dispatchCommand(ctx, name, body);
  const live = () => ctx.controller.getSnapshot();

  test("saving the table publishes zones and assignments into the snapshot", () => {
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    dispatch("set-assignments", { assignments: { 1: zone.id, 2: null, 3: null, 4: null } });
    expect(live().zones.map((z) => z.name)).toEqual(["Olive terrace"]);
    expect(live().assignments).toEqual({ 1: zone.id });
  });

  test("one zone on two channels is refused as a whole", () => {
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    expect(() => dispatch("set-assignments", { assignments: { 1: zone.id, 2: zone.id } })).toThrow(CommandError);
    expect(zones.currentAssignments()).toEqual({});
  });

  test("an archived zone cannot be assigned", () => {
    const zone = dispatch("create-zone", { name: "Tomato patch" }) as { id: string };
    dispatch("archive-zone", { id: zone.id });
    expect(() => dispatch("set-assignments", { assignments: { 1: zone.id } })).toThrow(CommandError);
  });

  test("editing is refused while the pump runs", () => {
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    ctx.controller.message("kc868-a8", "kc868-a8/switch/pump/state", "ON");
    expect(() => dispatch("set-assignments", { assignments: { 1: zone.id } })).toThrow("Stop the pump to edit assignments");
    expect(zones.currentAssignments()).toEqual({});
  });

  test("selecting an output channel shuts the others", () => {
    dispatch("select-output", { channel: 2 });
    expect(published).toEqual([
      { topic: "kc868-a8/switch/output_1/command", payload: "OFF" },
      { topic: "kc868-a8/switch/output_3/command", payload: "OFF" },
      { topic: "kc868-a8/switch/output_4/command", payload: "OFF" },
      { topic: "kc868-a8/switch/output_2/command", payload: "ON" },
    ]);
  });

  test("an unknown zone id is rejected rather than silently ignored", () => {
    expect(() => dispatch("rename-zone", { id: "nope", name: "X" })).toThrow(CommandError);
    expect(() => dispatch("archive-zone", { id: "nope" })).toThrow(CommandError);
  });

  test("a blank or oversized name is rejected", () => {
    expect(() => dispatch("create-zone", { name: "  " })).toThrow(CommandError);
    expect(() => dispatch("create-zone", { name: "x".repeat(41) })).toThrow(CommandError);
  });
});
