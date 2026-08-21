import type { DevicePort } from "../../../application/ports/device-port";
import { WateringEvent } from "../domain/watering-event";
import type { WateringEventRepository } from "./watering-event-repository";

export class WateringIngester {
  constructor(private repo: WateringEventRepository, private device: DevicePort) {}
  start(): () => void { return this.device.onWateringLog((payload) => this.onLog(payload)); }

  private onLog(payload: string): void {
    let parsed: unknown;
    try { parsed = JSON.parse(payload); } catch { return; }
    if (typeof parsed !== "object" || parsed === null) return;
    const { device, events } = parsed as { device?: unknown; events?: unknown };
    if (!Array.isArray(events)) return;
    const valid: WateringEvent[] = [];
    for (const raw of events) {
      if (typeof raw !== "object" || raw === null) continue;
      const value = raw as Record<string, unknown>;
      const event = WateringEvent.create({ deviceId: device, seq: value.seq, start: value.start, end: value.end, litres: value.litres, outcome: value.outcome, trigger: value.trigger, output: value.output });
      if (event.ok) valid.push(event.value);
    }
    if (valid.length > 0) this.repo.ingest(valid);
  }
}
