import { Entity } from "../../../shared-kernel/entity";
import { ZoneId } from "./zone-id";
import { ZoneName } from "./zone-name";

export class Zone extends Entity<ZoneId> {
  private constructor(id: ZoneId, readonly name: ZoneName, readonly archived: boolean) { super(id); }
  static create(id: ZoneId, name: ZoneName): Zone { return new Zone(id, name, false); }
  static rehydrate(id: ZoneId, name: ZoneName, archived: boolean): Zone { return new Zone(id, name, archived); }

  rename(name: ZoneName): Zone { return this.name.equals(name) ? this : new Zone(this.id, name, this.archived); }
  archive(): Zone { return this.archived ? this : new Zone(this.id, this.name, true); }
  unarchive(): Zone { return this.archived ? new Zone(this.id, this.name, false) : this; }
}
