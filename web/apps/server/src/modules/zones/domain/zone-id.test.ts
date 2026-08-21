import { describe, expect, test } from "bun:test";
import { ZoneId } from "./zone-id";

describe("ZoneId", () => {
  test("validates UUID identity", () => {
    const id = crypto.randomUUID();
    expect(ZoneId.rehydrate(id).toString()).toBe(id);
    expect(ZoneId.rehydrate(id).equals(ZoneId.rehydrate(id))).toBe(true);
    expect(ZoneId.create("zone-1").ok).toBe(false);
  });
});
