import { describe, expect, test } from "bun:test";
import { CommandError } from "../../../../application/handlers";
import { createZoneCommandHarness } from "../command-test-support";

describe("rename-zone", () => {
  test("renames the zone in the snapshot", () => {
    const { controller, dispatch } = createZoneCommandHarness();
    const zone = dispatch("create-zone", { name: "Tomato patch" }) as { id: string };
    dispatch("rename-zone", { id: zone.id, name: "Vegetable beds" });
    expect(controller.getSnapshot().zones[0]?.name).toBe("Vegetable beds");
  });

  test("rejects an unknown zone id", () => {
    const { dispatch } = createZoneCommandHarness();
    expect(() => dispatch("rename-zone", { id: crypto.randomUUID(), name: "X" })).toThrow(CommandError);
  });
});
