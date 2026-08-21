import { describe, expect, test } from "bun:test";
import { DeviceId } from "./device-id";

describe("DeviceId", () => {
  test("validates its primitive value", () => {
    expect(DeviceId.rehydrate(" controller ").toString()).toBe(" controller ");
    expect(DeviceId.create(" ").ok).toBe(false);
  });
});
