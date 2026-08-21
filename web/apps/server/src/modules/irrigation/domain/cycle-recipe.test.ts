import { describe, expect, test } from "bun:test";
import { CycleRecipe } from "./cycle-recipe";

describe("CycleRecipe", () => {
  test("validates and round-trips as one immutable value", () => {
    const raw = { mode: "Volume", total: 200, preWetPercent: 20, flushMinutes: 5 } as const;
    const recipe = CycleRecipe.rehydrate(raw);
    expect(recipe.toPrimitives()).toEqual(raw);
    expect(recipe.equals(CycleRecipe.rehydrate(recipe.toPrimitives()))).toBe(true);
    expect(CycleRecipe.create({ ...raw, flushMinutes: 0 }).ok).toBe(false);
    expect(CycleRecipe.create(null).ok).toBe(false);
  });
});
