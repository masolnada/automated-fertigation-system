import { describe, expect, test } from "bun:test";
import { Zone } from "./zone";
import { ZoneId } from "./zone-id";
import { ZoneName } from "./zone-name";

describe("Zone", () => {
  test("transitions preserve identity and are idempotent", () => {
    const zone = Zone.create(ZoneId.rehydrate(crypto.randomUUID()), ZoneName.rehydrate("One"));
    const archived = zone.archive();
    expect(archived.id.equals(zone.id)).toBe(true);
    expect(archived.archive()).toBe(archived);
    expect(archived.unarchive().archived).toBe(false);
    expect(zone.rename(ZoneName.rehydrate("One"))).toBe(zone);
  });
});
