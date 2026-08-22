import { describe, expect, test } from "bun:test";
import { ControllerSnapshotProjection } from "../../infrastructure/projections/controller-snapshot-projection";
import { getSnapshot } from "./get-snapshot";

describe("get-snapshot", () => {
  test("returns the current controller projection", () => {
    const controller = new ControllerSnapshotProjection();
    controller.connected();
    expect(getSnapshot({ controller }).brokerConnected).toBe(true);
  });
});
