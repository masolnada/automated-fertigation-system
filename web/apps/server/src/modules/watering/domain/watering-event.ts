import { Entity } from "../../../shared-kernel/entity";
import { OutputChannel } from "../../../shared-kernel/output-channel";
import { DomainError, err, ok, type Result } from "../../../shared-kernel/result";
import { DeviceId } from "./device-id";
import { LitresDelivered } from "./litres-delivered";
import { WateringEventId } from "./watering-event-id";
import { WateringEventSequence } from "./watering-event-sequence";
import { WateringOutcome } from "./watering-outcome";
import { WateringTimeRange } from "./watering-time-range";
import { WateringTrigger } from "./watering-trigger";

export class WateringEvent extends Entity<WateringEventId> {
  private constructor(
    id: WateringEventId,
    readonly timeRange: WateringTimeRange,
    readonly litresDelivered: LitresDelivered,
    readonly outcome: WateringOutcome,
    readonly trigger: WateringTrigger,
    readonly outputChannel: OutputChannel | null,
  ) { super(id); }

  static create(raw: { deviceId: unknown; seq: unknown; start: unknown; end: unknown; litres: unknown; outcome: unknown; trigger: unknown; output: unknown }): Result<WateringEvent> {
    const device = DeviceId.create(raw.deviceId); if (!device.ok) return device;
    const sequence = WateringEventSequence.create(raw.seq); if (!sequence.ok) return sequence;
    const timeRange = WateringTimeRange.fromEpochSeconds(raw.start, raw.end); if (!timeRange.ok) return timeRange;
    const litres = LitresDelivered.create(raw.litres); if (!litres.ok) return litres;
    const outcome = WateringOutcome.create(raw.outcome); if (!outcome.ok) return outcome;
    const trigger = WateringTrigger.create(raw.trigger); if (!trigger.ok) return trigger;
    let output: OutputChannel | null = null;
    if (raw.output !== 0) { const channel = OutputChannel.create(raw.output); if (!channel.ok) return channel; output = channel.value; }
    return ok(new WateringEvent(WateringEventId.of(device.value, sequence.value), timeRange.value, litres.value, outcome.value, trigger.value, output));
  }

  static rehydrate(raw: { deviceId: unknown; seq: unknown; startedAt: Date | null; endedAt: Date | null; litresDelivered: unknown; outcome: unknown; trigger: unknown; outputChannel: unknown }): WateringEvent {
    const device = DeviceId.rehydrate(raw.deviceId), sequence = WateringEventSequence.rehydrate(raw.seq);
    const litres = LitresDelivered.rehydrate(raw.litresDelivered), outcome = WateringOutcome.rehydrate(raw.outcome), trigger = WateringTrigger.rehydrate(raw.trigger);
    const output = raw.outputChannel === null ? null : OutputChannel.rehydrate(raw.outputChannel);
    const timeRange = WateringTimeRange.rehydrate(raw.startedAt, raw.endedAt);
    return new WateringEvent(WateringEventId.of(device, sequence), timeRange, litres, outcome, trigger, output);
  }
}
