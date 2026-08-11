import type { DevicePort, IngestedWateringEvent, WateringEventRepository } from "../domain/ports";

const OUTCOMES = new Set(["completed", "aborted", "dry_run", "recovery"]);
const TRIGGERS = new Set(["manual", "sequence"]);

/**
 * Ingests the controller's authoritative watering-event log. Subscribes to the
 * retained `watering/log`, parses the array, and hands new events to the
 * repository, which dedups by `(deviceId, seq)`. This one path covers live
 * publishes, reconnect backfill, and broker restart identically — no detection,
 * no timers. The controller is the source of truth (controller ADR-0012).
 */
export class WateringIngester {
  constructor(private repo: WateringEventRepository, private device: DevicePort) {}

  start(): () => void {
    return this.device.onWateringLog((payload) => this.onLog(payload));
  }

  private onLog(payload: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return;
    }
    const events = this.parse(parsed);
    if (events.length > 0) this.repo.ingest(events);
  }

  /** Defensive parse — this is a device boundary, so validate every field. */
  private parse(payload: unknown): IngestedWateringEvent[] {
    if (typeof payload !== "object" || payload === null) return [];
    const { device, events } = payload as { device?: unknown; events?: unknown };
    if (typeof device !== "string" || device === "" || !Array.isArray(events)) return [];
    const out: IngestedWateringEvent[] = [];
    for (const raw of events) {
      const event = this.parseEvent(device, raw);
      if (event) out.push(event);
    }
    return out;
  }

  private parseEvent(deviceId: string, raw: unknown): IngestedWateringEvent | null {
    if (typeof raw !== "object" || raw === null) return null;
    const { seq, start, end, litres, outcome, trigger, zone } = raw as Record<string, unknown>;
    if (!Number.isInteger(seq)) return null;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (!Number.isFinite(litres)) return null;
    if (typeof outcome !== "string" || !OUTCOMES.has(outcome)) return null;
    if (typeof trigger !== "string" || !TRIGGERS.has(trigger)) return null;
    // 0 is the device's "clock not set" sentinel (no RTC, no network) -> unknown time.
    const epoch = (value: number): Date | null => (value > 0 ? new Date(value * 1000) : null);
    return {
      deviceId,
      seq: seq as number,
      startedAt: epoch(start as number),
      endedAt: epoch(end as number),
      litresDelivered: litres as number,
      outcome,
      trigger,
      // 0 is the device's "no zone recorded" sentinel, mirroring the epoch-0 clock one.
      zone: typeof zone === "number" && Number.isInteger(zone) && zone > 0 ? zone : null,
    };
  }
}
