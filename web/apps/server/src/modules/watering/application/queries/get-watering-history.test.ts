import { describe, expect, test } from "bun:test";
import { openDatabase } from "../../../../infrastructure/db/database";
import { DrizzleZoneRepository } from "../../../zones/infrastructure/drizzle-zone-repository";
import { DrizzleWateringEventRepository } from "../../infrastructure/drizzle-watering-event-repository";
import { getWateringHistory } from "./get-watering-history";

describe("get-watering-history", () => {
  test("returns the empty history shape for a range with no events", () => {
    const db = openDatabase(":memory:");
    const zones = new DrizzleZoneRepository(db);
    const wateringEvents = new DrizzleWateringEventRepository(db, zones);
    expect(getWateringHistory(
      { zones, wateringEvents },
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-01-02T00:00:00Z"),
    )).toEqual({ chartEvents: [], lastWatering: null, earliestEventAt: null });
  });
});
