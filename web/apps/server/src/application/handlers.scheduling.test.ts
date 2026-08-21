import { beforeEach, describe, expect, test } from "bun:test";
import { openDatabase, type Db } from "../infrastructure/db/database";
import { DrizzleScheduleRepository } from "../modules/scheduling/infrastructure/drizzle-schedule-repository";
import { DrizzleZoneRepository } from "../modules/zones/infrastructure/drizzle-zone-repository";
import { DrizzleWateringEventRepository } from "../modules/watering/infrastructure/drizzle-watering-event-repository";
import { dispatchCommand } from "./dispatch";
import { ControllerSnapshotProjection } from "../infrastructure/projections/controller-snapshot-projection";
import { SystemClock } from "../shared-kernel/clock";
import { UuidGenerator } from "../shared-kernel/id-generator";
import { CommandError, SCHEDULE_MAX, type Context } from "./handlers";

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
    controller: new ControllerSnapshotProjection(),
    zones,
    schedules,
    wateringEvents: new DrizzleWateringEventRepository(db, zones),
    clock: new SystemClock(),
    ids: new UuidGenerator(),
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
    for (let n = 0; n < SCHEDULE_MAX; n++) dispatch("create-schedule", entry({ time: `06:${String(n).padStart(2, "0")}` }));
    expect(() => dispatch("create-schedule", entry({ time: "07:00" }))).toThrow(CommandError);
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(SCHEDULE_MAX);
  });
});

/**
 * One pump and one `mode: single` sequence, so a time slot belongs to the
 * machine rather than to a zone. The Skipped run is the safety net; refusing to
 * create the entry is the fix (controller ADR-0018).
 */
describe("a time slot can only be taken once", () => {
  const rejects = (body: unknown) => expect(() => dispatch("create-schedule", body)).toThrow(CommandError);

  test("the same time on another channel is refused, not just the same channel", () => {
    dispatch("create-schedule", entry({ channel: 1 }));
    rejects(entry({ channel: 2 }));
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(1);
  });

  test("the refusal names the time and the channel already holding it", () => {
    dispatch("create-schedule", entry({ channel: 3, time: "06:00" }));
    expect(() => dispatch("create-schedule", entry({ channel: 1, time: "06:00" }))).toThrow(/06:00 is already taken by the schedule on output 3/);
  });

  /** Same clock time, no shared day: these two can never both come due. */
  test("the same time on days that never coincide is allowed", () => {
    dispatch("create-schedule", entry({ frequency: { kind: "weekdays", days: [2, 5] } }));
    dispatch("create-schedule", entry({ channel: 2, frequency: { kind: "weekdays", days: [1, 4] } }));
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(2);
  });

  test("overlapping weekday sets at the same time are refused", () => {
    dispatch("create-schedule", entry({ frequency: { kind: "weekdays", days: [2, 5] } }));
    rejects(entry({ channel: 2, frequency: { kind: "weekdays", days: [5, 6] } }));
  });

  test("a different time on the same days is allowed", () => {
    dispatch("create-schedule", entry({ time: "06:00" }));
    dispatch("create-schedule", entry({ channel: 2, time: "06:01" }));
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(2);
  });

  /**
   * Two every-2-day entries on opposite phases interleave forever, so they are
   * genuinely compatible even at the same time of day.
   */
  test("every-N cadences that interleave are allowed", () => {
    dispatch("create-schedule", entry({ frequency: { kind: "everyN", n: 2, from: "2026-03-16" } }));
    dispatch("create-schedule", entry({ channel: 2, frequency: { kind: "everyN", n: 2, from: "2026-03-17" } }));
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(2);
  });

  test("every-N cadences that eventually land together are refused", () => {
    dispatch("create-schedule", entry({ frequency: { kind: "everyN", n: 3, from: "2026-03-16" } }));
    rejects(entry({ channel: 2, frequency: { kind: "everyN", n: 2, from: "2026-03-17" } }));
  });

  /** Every 7 days from a Monday *is* "every Monday", however it is spelled. */
  test("a weekly cadence collides with the weekday it lands on", () => {
    dispatch("create-schedule", entry({ frequency: { kind: "everyN", n: 7, from: "2026-03-16" } }));
    rejects(entry({ channel: 2, frequency: { kind: "weekdays", days: [1] } }));
    dispatch("create-schedule", entry({ channel: 2, frequency: { kind: "weekdays", days: [2] } }));
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(2);
  });

  test("nothing is published when a colliding entry is refused", () => {
    dispatch("create-schedule", entry());
    const before = published.length;
    rejects(entry({ channel: 2 }));
    expect(published).toHaveLength(before);
  });

  /** Deleting frees the slot: the guard reads the current set, not a history of it. */
  test("deleting an entry frees its slot", () => {
    const first = dispatch("create-schedule", entry({ channel: 1 })) as { id: string };
    rejects(entry({ channel: 2 }));
    dispatch("delete-schedule", { id: first.id });
    dispatch("create-schedule", entry({ channel: 2 }));
    expect(ctx.controller.getSnapshot().schedules).toHaveLength(1);
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
    dispatch("delete-schedule", { id: crypto.randomUUID() });
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
    dispatch("create-schedule", entry({ channel: 1, time: "06:00" }));
    dispatch("create-schedule", entry({ channel: 2, time: "07:00" }));

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
