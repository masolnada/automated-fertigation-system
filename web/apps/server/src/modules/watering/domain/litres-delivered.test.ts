import { describe, expect, test } from "bun:test";
import { LitresDelivered } from "./litres-delivered";

describe("LitresDelivered", () => {
  test("validates its primitive range", () => {
    expect(LitresDelivered.create(0).ok).toBe(true);
    expect(LitresDelivered.create(12.4).ok).toBe(true);
    expect(LitresDelivered.create(-0.1).ok).toBe(false);
  });
});
