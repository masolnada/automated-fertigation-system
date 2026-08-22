import { describe, expect, test } from "bun:test";
import { CommandError } from "../../../../application/handlers";
import { createZoneCommandHarness } from "../command-test-support";

describe("create-zone", () => {
  test("creates a live zone and publishes it into the snapshot", () => {
    const { controller, dispatch } = createZoneCommandHarness();
    const zone = dispatch("create-zone", { name: "Olive terrace" }) as { id: string; name: string; archived: boolean };
    expect(zone).toMatchObject({ name: "Olive terrace", archived: false });
    expect(controller.getSnapshot().zones).toEqual([zone]);
  });

  test("rejects blank and oversized names", () => {
    const { dispatch } = createZoneCommandHarness();
    expect(() => dispatch("create-zone", { name: "  " })).toThrow(CommandError);
    expect(() => dispatch("create-zone", { name: "x".repeat(41) })).toThrow(CommandError);
  });
});
