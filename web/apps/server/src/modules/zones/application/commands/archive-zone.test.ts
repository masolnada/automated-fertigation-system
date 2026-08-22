import { describe, expect, test } from "bun:test";
import { CommandError } from "../../../../application/handlers";
import { createZoneCommandHarness } from "../command-test-support";

const recipe = { mode: "Volume" as const, total: 200, preWetPercent: 20, flushMinutes: 5 };
const schedule = (partial: Record<string, unknown> = {}) => ({
  time: "06:00",
  frequency: { kind: "weekdays", days: [2, 5] },
  channel: 1,
  recipe,
  ...partial,
});

describe("archive-zone", () => {
  test("archives the zone and clears its assignment", () => {
    const { controller, dispatch } = createZoneCommandHarness();
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    dispatch("set-assignments", { assignments: { 1: zone.id } });
    dispatch("archive-zone", { id: zone.id });
    expect(controller.getSnapshot().zones[0]?.archived).toBe(true);
    expect(controller.getSnapshot().assignments).toEqual({});
  });

  test("refuses assignment clearing while the pump runs", () => {
    const { controller, dispatch, zones } = createZoneCommandHarness();
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    dispatch("set-assignments", { assignments: { 1: zone.id } });
    controller.message("kc868-a8", "kc868-a8/switch/pump/state", "ON");
    expect(() => dispatch("archive-zone", { id: zone.id })).toThrow("Stop the pump to edit assignments");
    expect(zones.currentAssignments().toRecord()).toEqual({ 1: zone.id });
  });

  test("deletes schedules on the archived zone's channel", () => {
    const { controller, dispatch } = createZoneCommandHarness();
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    dispatch("set-assignments", { assignments: { 1: zone.id } });
    dispatch("create-schedule", schedule({ channel: 1, time: "06:00" }));
    dispatch("create-schedule", schedule({ channel: 2, time: "07:00" }));
    dispatch("archive-zone", { id: zone.id });
    expect(controller.getSnapshot().schedules.map((entry) => entry.channel)).toEqual([2]);
  });

  test("leaves schedules alone when the zone is unassigned", () => {
    const { controller, dispatch } = createZoneCommandHarness();
    const zone = dispatch("create-zone", { name: "Tomato patch" }) as { id: string };
    dispatch("create-schedule", schedule());
    dispatch("archive-zone", { id: zone.id });
    expect(controller.getSnapshot().schedules).toHaveLength(1);
  });

  test("rejects an unknown zone id", () => {
    const { dispatch } = createZoneCommandHarness();
    expect(() => dispatch("archive-zone", { id: crypto.randomUUID() })).toThrow(CommandError);
  });
});
