import { describe, expect, test } from "bun:test";
import { createZoneCommandHarness } from "../command-test-support";

describe("unarchive-zone", () => {
  test("restores the zone without restoring its assignment", () => {
    const { controller, dispatch } = createZoneCommandHarness();
    const zone = dispatch("create-zone", { name: "Herb strip" }) as { id: string };
    dispatch("set-assignments", { assignments: { 2: zone.id } });
    dispatch("archive-zone", { id: zone.id });
    dispatch("unarchive-zone", { id: zone.id });
    expect(controller.getSnapshot().zones[0]?.archived).toBe(false);
    expect(controller.getSnapshot().assignments).toEqual({});
  });
});
