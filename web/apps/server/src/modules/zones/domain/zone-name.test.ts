import { describe, expect, test } from "bun:test";
import { ZoneName } from "./zone-name";

describe("ZoneName", () => {
  test("trims, bounds and compares normalized values", () => {
    expect(ZoneName.rehydrate("  Olive terrace  ").toString()).toBe("Olive terrace");
    expect(ZoneName.rehydrate(" Olive terrace ").equals(ZoneName.rehydrate("Olive terrace"))).toBe(true);
    expect(ZoneName.create("").ok).toBe(false);
    expect(ZoneName.create("x".repeat(40)).ok).toBe(true);
    expect(ZoneName.create("x".repeat(41)).ok).toBe(false);
  });
});
