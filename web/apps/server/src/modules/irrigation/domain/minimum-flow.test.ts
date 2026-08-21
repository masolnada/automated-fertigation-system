import { describe, expect, test } from "bun:test";
import { MinimumFlow } from "./minimum-flow";

describe("MinimumFlow", () => {
  test("enforces machine limits", () => {
    for (const n of [0, 10]) expect(MinimumFlow.create(n).ok).toBe(true);
    for (const n of [-0.1, 10.1]) expect(MinimumFlow.create(n).ok).toBe(false);
  });
});
