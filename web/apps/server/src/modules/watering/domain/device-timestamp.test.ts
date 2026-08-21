import { describe, expect, test } from "bun:test";
import { DeviceTimestamp } from "./device-timestamp";

const value = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw result.error;
  return result.value;
};

describe("DeviceTimestamp", () => {
  test("preserves epoch-zero as unknown", () => {
    const unknown = value(DeviceTimestamp.fromEpochSeconds(0));
    expect(unknown.isKnown()).toBe(false);
    expect(unknown.toDate()).toBeNull();
  });

  test("round-trips known timestamps", () => {
    const known = value(DeviceTimestamp.fromEpochSeconds(1_739_112_000));
    expect(known.toIsoString()).toBe(new Date(1_739_112_000_000).toISOString());
    expect(known.equals(DeviceTimestamp.fromDate(known.toDate()))).toBe(true);
  });
});
