import { ValueObject } from "../../../shared-kernel/value-object";
import { DeviceId } from "./device-id";
import { WateringEventSequence } from "./watering-event-sequence";

export class WateringEventId extends ValueObject {
  private constructor(readonly deviceId: DeviceId, readonly sequence: WateringEventSequence) { super(); }
  static of(deviceId: DeviceId, sequence: WateringEventSequence): WateringEventId { return new WateringEventId(deviceId, sequence); }
  toString(): string { return `${this.deviceId.toString()}:${this.sequence.toNumber()}`; }
  protected equalityComponents(): readonly unknown[] { return [this.deviceId.toString(), this.sequence.toNumber()]; }
}
