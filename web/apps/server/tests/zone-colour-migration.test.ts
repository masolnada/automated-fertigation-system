import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../src/infrastructure/db/database";
import { DrizzleZoneRepository } from "../src/modules/zones/infrastructure/drizzle-zone-repository";
import { Zone } from "../src/modules/zones/domain/zone";
import { ZoneId } from "../src/modules/zones/domain/zone-id";
import { ZoneName } from "../src/modules/zones/domain/zone-name";

describe("Zone colour drop migration", () => {
  test("0006 drops the colour column while preserving every Zone row", () => {
    const sqlite = new Database(":memory:");
    // The table as ADR-0018 left it: a NOT NULL unique `colour`.
    sqlite.exec(`
      CREATE TABLE zones (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        colour text NOT NULL,
        archived integer DEFAULT false NOT NULL,
        created_at integer NOT NULL,
        CONSTRAINT zones_colour_unique UNIQUE(colour)
      );
      INSERT INTO zones (id, name, colour, archived, created_at) VALUES
        ('z-1', 'One', 'terracotta', 0, 100),
        ('z-2', 'Two', 'ochre', 1, 200);
    `);

    const migration = readFileSync(join(import.meta.dir, "../drizzle/0006_drop_zone_colour.sql"), "utf8").replaceAll("--> statement-breakpoint", "");
    sqlite.exec(migration);

    const columns = (sqlite.query("PRAGMA table_info(zones)").all() as Array<{ name: string }>).map((row) => row.name);
    expect(columns).toEqual(["id", "name", "archived", "created_at"]);
    expect(sqlite.query("SELECT id, name, archived FROM zones ORDER BY created_at").all()).toEqual([
      { id: "z-1", name: "One", archived: 0 },
      { id: "z-2", name: "Two", archived: 1 },
    ]);
    sqlite.close();
  });

  test("the full migration chain leaves a colourless zones table a repository can write", () => {
    const zones = new DrizzleZoneRepository(openDatabase(":memory:"));
    const zone = Zone.create(ZoneId.rehydrate(crypto.randomUUID()), ZoneName.rehydrate("Olive terrace"));
    zones.add(zone, new Date());
    expect(zones.all()[0]!.name.toString()).toBe("Olive terrace");
    expect(zones.all()[0]!.archived).toBe(false);
  });
});
