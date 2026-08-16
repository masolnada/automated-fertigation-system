import { beforeEach, describe, expect, test } from "bun:test";
import { openDatabase, type Db } from "../src/infrastructure/db/database";
import { DrizzleScheduleRepository } from "../src/infrastructure/db/schedule-repository";
import { DrizzleZoneRepository } from "../src/infrastructure/db/zone-repository";
import { dispatchCommand } from "../src/application/dispatch";
import { Controller } from "../src/domain/controller";
import { CommandError, SCHEDULE_MAX, type Context } from "../src/application/handlers";

let db: Db;
let schedules: DrizzleScheduleRepository;
let zones: DrizzleZoneRepository;
let ctx: Context;
let published: Array<{ topic: string; payload: string; retain: boolean }>;

const recipe = { mode: "Volume" as const, total: 200, preWetPercent: 20, flushMinutes: 5 };
const entry = (partial: Record<string, unknown> = {}) => ({ time: "06:00", frequency: { kind: "weekdays", days: [2, 5] }, channel: 1, recipe, ...partial });

beforeEach(() => {
  db = openDatabase(":memory:");
  schedules = new DrizzleScheduleRepository(db);
  zones = new DrizzleZoneRepository(db);
  published = [];
  ctx = {
    controller: new Controller(),
    zones,
    schedules,
    device: { prefix: "kc868-a8", publish: (topic, payload, options) => { published.push({ topic, payload, retain: options?.retain ?? false }); }, onResetResult: () => () => {}, onWateringLog: () => () => {} },
  };
});

const dispatch = (name: string, body: unknown) => dispatchCommand(ctx, name, body);
const lastSet = () => JSON.parse(published.filter((message) => message.topic.endsWith("/schedule/set")).at(-1)!.payload) as { entries: Array<Record<string, number | string>> };

describe("creating a schedule", () => {
  test("an entry is stored whole and pushed into the snapshot", () => {
    const created = dispatch("create-schedule", entry()) as { id: string };
    expect(created.id).toBeTruthy();
    const [stored] = ctx.controller.getSnapshot().schedules;
    expect(stored).toMatchObject({ time: "06:00", channel: 1, recipe });
    expect(stored!.frequency).toEqual({ kind: "weekdays", days: [2, 5] });
  });

  /**
   * Retained because the controller is usually out of contact when an edit is
   * made: the broker holding the latest set is what makes it land on reconnect
   * with no reconciliation (web ADR-0017).
   */
  test("the whole set is published retained", () => {
    dispatch("create-schedule", entry());
    dispatch("create-schedule", entry({ channel: 2, time: "19:30" }));
    const message = published.filter((m) => m.topic === "kc868-a8/schedule/set").at(-1)!;
    expect(message.retain).toBe(true);
    expect(lastSet().entries).toHaveLength(2);
  });

  /**
   * The device gets a flattened form it can evaluate with no allocation: a
   * weekday bitmask (bit 0 = Monday) and the recipe as plain numbers.
   */
  test("weekdays travel as a bitmask the device can test with one AND", () => {
    dispatch("create-schedule", entry({ frequency: { kind: "weekdays", days: [1, 3] } }));
    expect(lastSet().entries[0]).toMatchObject({ hour: 6, minute: 0, mask: 0b101, every: 0, channel: 1, volume: 1, total: 200, prewet: 20, flush: 5 });
  });

  test("every-N-days travels as an anchor in whole days since the epoch", () => {
    dispatch("create-schedule", entry({ frequency: { kind: "everyN", n: 3, from: "2026-03-14" } }));
    expect(lastSet().entries[0]).toMatchObject({ mask: 0, every: 3, from: Math.floor(Date.UTC(2026, 2, 14) / 86_400_000) });
  });

  test("duplicate weekdays are collapsed and sorted", () => {
    dispatch("create-schedule", entry({ frequency: { kind: "weekdays", days: [5, 2, 5] } }));
    expect(ctx.controller.getSnapshot().schedules[0]!.frequency).toEqual({ kind: "weekdays", days: [2, 5] });
  });
});

describe("a schedule entry must be able to actually water", () => {
  const rejects = (body: unknown) => expect(() => dispatch("create-schedule", body)).toThrow(CommandError);

  test("a time outside a 24-hour clock is refused", () => {
    for (const time of ["", "6:00", "24:00", "06:60", "0600", "06:00:00"]) rejects(entry({ time }));
  });

  /** An empty weekday set fires on no day: an entry that looks scheduled and never waters. */
  test("a frequency that never fires is refused", () => {
    rejects(entry({ frequency: { kind: "weekdays", days: [] } }));
    rejects(entry({ frequency: { kind: "weekdays", days: [0] } }));
    rejects(entry({ frequency: { kind: "weekdays", days: [8] } }));
    rejects(entry({ frequency: { kind: "everyN", n: 0, from: "2026-03-14" } }));
    rejects(entry({ frequency: { kind: "everyN", n: 3, from: "14-03-2026" } }));
    rejects(entry({ frequency: { kind: "monthly", day: 1 } }));
  });

  test("a channel outside 1-4 is refused", () => {
    for (const channel of [0, 5, "2", undefined]) rejects(entry({ channel }));
  });

  /** The flush is what guarantees no residue, so it cannot be scheduled away. */
  test("a recipe outside the device's own ranges is refused", () => {
    rejects(entry({ recipe: { ...recipe, flushMinutes: 0 } }));
    rejects(entry({ recipe: { ...recipe, total: 9999 } }));
    rejects(entry({ recipe: { ...recipe, preWetPercent: 300 } }));
    rejects(entry({ recipe: { ...recipe, mode: "Drip" } }));
    rejects(entry({ recipe: undefined }));
  });

  test("nothing is published when an entry is refused", () => {
    rejects(entry({ time: "nope" }));
    expect(published).toHaveLength(0);
  });

  /** The device holds a fixed-size table; a 17th entry would silently never fire. */
  test("more entries than the device can hold are refused", () => {
    for (let n = 0; n < SCHEDULE_MAX; n++) dispatch("create-schedule", entry());
    expect(() => dispatch("create-schedule", entry())).toThrow(CommandError);
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(SCHEDULE_MAX);
  });
});

describe("deleting a schedule", () => {
  test("the entry goes and the new set is published", () => {
    const created = dispatch("create-schedule", entry()) as { id: string };
    dispatch("delete-schedule", { id: created.id });
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(0);
    expect(lastSet().entries).toHaveLength(0);
  });

  test("an unknown id is a no-op rather than an error", () => {
    dispatch("create-schedule", entry());
    dispatch("delete-schedule", { id: "not-a-real-id" });
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(1);
  });

  test("a missing id is refused", () => {
    expect(() => dispatch("delete-schedule", {})).toThrow(CommandError);
  });
});

/**
 * Archiving takes a zone out of service, so the entries standing on its channel
 * go with it: left behind they would keep watering, with nothing on screen
 * naming them.
 */
describe("archiving a zone takes its schedules", () => {
  test("entries on the archived zone's channel are deleted", () => {
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    dispatch("set-assignments", { assignments: { 1: zone.id, 2: null, 3: null, 4: null } });
    dispatch("create-schedule", entry({ channel: 1 }));
    dispatch("create-schedule", entry({ channel: 2 }));

    dispatch("archive-zone", { id: zone.id });

    const remaining = ctx.controller.getSnapshot().schedules;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.channel).toBe(2);
    expect(lastSet().entries).toHaveLength(1);
  });

  test("archiving an unassigned zone leaves every schedule alone", () => {
    const zone = dispatch("create-zone", { name: "Tomato patch" }) as { id: string };
    dispatch("create-schedule", entry({ channel: 1 }));
    dispatch("archive-zone", { id: zone.id });
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(1);
  });
});
