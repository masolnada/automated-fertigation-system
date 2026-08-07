import type { Controller } from "../domain/controller";
import type { WateringEventRepository } from "../domain/ports";

const GRACE_MS = 30_000;

type OpenEvent = { id: number; startTotal: number; peakFlow: number; flowSum: number; flowCount: number };

/**
 * Records watering events by observing pump transitions in the read-model
 * snapshot. A watering event is a pump-on span; the pump's ~4s intra-handover
 * pump-off gaps are absorbed by a grace period, so one sequence is one event.
 * Write-on-start: a row is inserted at pump-on and finalized once the pump has
 * stayed off for the grace period. Reconciles a dangling open row on startup.
 */
export class WateringRecorder {
  private open: OpenEvent | null = null;
  private pumpWasOn = false;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingFinal: { endedAt: Date; endTotal: number } | null = null;
  private reconciled = false;
  private lastTotal: number | null = null;

  constructor(
    private repo: WateringEventRepository,
    private controller: Controller,
    private graceMs = GRACE_MS,
    private now: () => Date = () => new Date(),
  ) {}

  /** Subscribe to snapshot changes; returns an unsubscribe. */
  start(): () => void {
    const unsubscribe = this.controller.subscribe(() => this.onSnapshot());
    this.onSnapshot();
    return unsubscribe;
  }

  private onSnapshot(): void {
    const { entities } = this.controller.getSnapshot();
    const pump = entities.pump, total = entities.total_water, flow = entities.flow_rate;
    const pumpKnown = pump?.known === true;
    const totalValue = total?.known ? Number(total.value) : NaN;
    if (Number.isFinite(totalValue)) this.lastTotal = totalValue;
    const currentTotal = this.lastTotal;
    const flowValue = flow?.known ? Number(flow.value) : NaN;

    if (!this.reconciled && pumpKnown && Number.isFinite(totalValue)) this.reconcile(pump.value === "ON", totalValue);
    if (!pumpKnown) return;
    const pumpOn = pump.value === "ON";

    if (pumpOn && this.open && Number.isFinite(flowValue)) {
      this.open.peakFlow = Math.max(this.open.peakFlow, flowValue);
      this.open.flowSum += flowValue;
      this.open.flowCount += 1;
    }

    if (pumpOn && !this.pumpWasOn) this.onPumpOn(currentTotal);
    else if (!pumpOn && this.pumpWasOn) this.onPumpOff(currentTotal);
    this.pumpWasOn = pumpOn;
  }

  private onPumpOn(total: number | null): void {
    if (this.graceTimer) { clearTimeout(this.graceTimer); this.graceTimer = null; this.pendingFinal = null; return; } // handover: resume the open event
    if (this.open) return;
    const id = this.repo.insertOpen(this.now(), total ?? 0);
    this.open = { id, startTotal: total ?? 0, peakFlow: 0, flowSum: 0, flowCount: 0 };
  }

  private onPumpOff(total: number | null): void {
    if (!this.open) return;
    this.pendingFinal = { endedAt: this.now(), endTotal: total ?? this.open.startTotal };
    this.graceTimer = setTimeout(() => this.finalize(), this.graceMs);
  }

  private finalize(): void {
    if (!this.open || !this.pendingFinal) return;
    const litres = Math.max(0, this.pendingFinal.endTotal - this.open.startTotal);
    const peak = this.open.flowCount ? this.open.peakFlow : null;
    const avg = this.open.flowCount ? this.open.flowSum / this.open.flowCount : null;
    this.repo.finalize(this.open.id, this.pendingFinal.endedAt, litres, peak, avg);
    this.open = null;
    this.pendingFinal = null;
    this.graceTimer = null;
  }

  private reconcile(pumpOn: boolean, total: number): void {
    this.reconciled = true;
    const dangling = this.repo.openEvent();
    if (!dangling) return;
    if (pumpOn) {
      this.open = { id: dangling.id, startTotal: dangling.startTotalWater, peakFlow: 0, flowSum: 0, flowCount: 0 };
      this.pumpWasOn = true;
    } else {
      this.repo.finalize(dangling.id, this.now(), Math.max(0, total - dangling.startTotalWater), null, null);
    }
  }
}
