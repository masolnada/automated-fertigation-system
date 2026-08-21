import { describe, expect, test } from "bun:test";
import { AssignmentTable } from "./assignment-table";
import { ZoneId } from "./zone-id";

const value = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw result.error;
  return result.value;
};

describe("AssignmentTable", () => {
  test("owns eligibility and one-to-one invariants", () => {
    const first = ZoneId.rehydrate(crypto.randomUUID());
    const second = ZoneId.rehydrate(crypto.randomUUID());
    const table = value(AssignmentTable.create({ 1: first.toString(), 2: second.toString(), 3: null, 4: null }, [first, second]));
    expect(table.toRecord()).toEqual({ 1: first.toString(), 2: second.toString() });
    expect(table.equals(AssignmentTable.rehydrate(table.entries()))).toBe(true);
    expect(AssignmentTable.create({ 1: first.toString(), 2: first.toString() }, [first]).ok).toBe(false);
    expect(AssignmentTable.create({ 5: first.toString() }, [first]).ok).toBe(false);
    expect(AssignmentTable.create({ 1: crypto.randomUUID() }, [first]).ok).toBe(false);
  });
});
