import type { ValueObject } from "./value-object";

export abstract class Entity<Id extends ValueObject> {
  protected constructor(readonly id: Id) {}

  equals(other: this | null | undefined): boolean {
    return Boolean(other && this.constructor === other.constructor && this.id.equals(other.id));
  }
}
