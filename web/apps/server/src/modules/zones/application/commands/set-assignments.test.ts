import { describe, expect, test } from "bun:test";
import { CommandError } from "../../../../application/handlers";
import { createZoneCommandHarness } from "../command-test-support";

describe("set-assignments", () => {
  test("publishes the whole assignment table into the snapshot", () => {
    const { controller, dispatch } = createZoneCommandHarness();
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    dispatch("set-assignments", { assignments: { 1: zone.id, 2: null, 3: null, 4: null } });
    expect(controller.getSnapshot().assignments).toEqual({ 1: zone.id });
  });

  test("refuses one zone on two channels as a whole", () => {
    const { dispatch, zones } = createZoneCommandHarness();
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    expect(() => dispatch("set-assignments", { assignments: { 1: zone.id, 2: zone.id } })).toThrow(CommandError);
    expect(zones.currentAssignments().toRecord()).toEqual({});
  });

  test("refuses assigning an archived zone", () => {
    const { dispatch } = createZoneCommandHarness();
    const zone = dispatch("create-zone", { name: "Tomato patch" }) as { id: string };
    dispatch("archive-zone", { id: zone.id });
    expect(() => dispatch("set-assignments", { assignments: { 1: zone.id } })).toThrow(CommandError);
  });

  test("refuses edits while the pump runs", () => {
    const { controller, dispatch, zones } = createZoneCommandHarness();
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string };
    dispatch("set-assignments", { assignments: { 1: zone.id } });
    controller.message("kc868-a8", "kc868-a8/switch/pump/state", "ON");
    expect(() => dispatch("set-assignments", { assignments: { 2: zone.id } })).toThrow("Stop the pump to edit assignments");
    expect(zones.currentAssignments().toRecord()).toEqual({ 1: zone.id });
  });
});
