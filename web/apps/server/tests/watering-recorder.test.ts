import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Controller } from "../src/domain/controller";
import { WateringRecorder } from "../src/application/watering-recorder";
import { openDatabase } from "../src/infrastructure/db/database";
import { DrizzleWateringEventRepository } from "../src/infrastructure/db/watering-repository";

const prefix = "test-hort";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const graceMs = 60;

// A controller notifies on a 0ms setTimeout tick; give the recorder a chance to run.
const settle = () => sleep(15);

function pump(controller: Controller, on: boolean) { controller.message(prefix, `${prefix}/switch/pump/state`, on ? "ON" : "OFF"); }
function total(controller: Controller, litres: number) { controller.message(prefix, `${prefix}/sensor/total_water/state`, String(litres)); }
function flow(controller: Controller, rate: number) { controller.message(prefix, `${prefix}/sensor/flow_rate/state`, String(rate)); }

describe("WateringRecorder", () => {
  let controller: Controller;
  let repo: DrizzleWateringEventRepository;
  let stop: () => void;

  beforeEach(() => {
    controller = new Controller();
    repo = new DrizzleWateringEventRepository(openDatabase(":memory:"));
  });
  afterEach(() => stop?.());

  test("records one event across the sequence's intra-handover pump gaps", async () => {
    stop = new WateringRecorder(repo, controller, graceMs).start();
    total(controller, 100);
    pump(controller, true); flow(controller, 5); await settle();
    // handover: pump off briefly, then back on — must stay one event
    pump(controller, false); await sleep(20); pump(controller, true); flow(controller, 6); total(controller, 108); await settle();
    pump(controller, false); total(controller, 110); await settle();

    // still open during the grace window
    expect(repo.recent(10).filter((e) => e.endedAt === null)).toHaveLength(1);
    await sleep(graceMs + 30);

    const events = repo.recent(10);
    expect(events).toHaveLength(1);
    expect(events[0]!.endedAt).not.toBeNull();
    expect(events[0]!.litresDelivered).toBeCloseTo(10, 5);
    expect(events[0]!.peakFlow).toBeCloseTo(6, 5);
  });

  test("two waterings separated by more than the grace are two events", async () => {
    stop = new WateringRecorder(repo, controller, graceMs).start();
    total(controller, 0);
    pump(controller, true); total(controller, 5); await settle();
    pump(controller, false); await settle();
    await sleep(graceMs + 30);
    pump(controller, true); total(controller, 12); await settle();
    pump(controller, false); await settle();
    await sleep(graceMs + 30);

    const events = repo.recent(10);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.endedAt !== null)).toBe(true);
  });

  test("finalizes a dangling open row on startup when the pump is off", async () => {
    const id = repo.insertOpen(new Date(), 20);
    expect(repo.openEvent()?.id).toBe(id);

    stop = new WateringRecorder(repo, controller, graceMs).start();
    pump(controller, false); total(controller, 27); await settle();

    const row = repo.recent(10).find((e) => e.id === id)!;
    expect(row.endedAt).not.toBeNull();
    expect(row.litresDelivered).toBeCloseTo(7, 5);
  });
});
