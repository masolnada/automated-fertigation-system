import type { EntityValue, LogEntry, Severity, Snapshot } from "@hort/contracts";
import { parseStateTopic } from "./topics";

const empty = (): Snapshot => ({ brokerConnected: false, deviceOnline: false, entities: {}, valves: { clean_water_valve: false, fertigation_valve: false }, resetPending: false, log: [] });

/**
 * The fertigation controller aggregate: current device snapshot plus the rolling
 * event log. Folds raw MQTT topics into the read model. Notifications to
 * subscribers are coalesced to one snapshot per tick so retained-message bursts
 * produce a single downstream push.
 */
export class Controller {
  private snapshot = empty();
  private listeners = new Set<() => void>();
  private notifyScheduled = false;

  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = (): Snapshot => this.snapshot;

  private update(change: Partial<Snapshot>): void {
    this.snapshot = { ...this.snapshot, ...change };
    if (this.notifyScheduled) return;
    this.notifyScheduled = true;
    setTimeout(() => { this.notifyScheduled = false; this.listeners.forEach((listener) => listener()); }, 0);
  }

  log(message: string, severity: Severity = "normal"): void {
    const entry: LogEntry = { message, severity, time: new Date().toISOString() };
    this.update({ log: [entry, ...this.snapshot.log].slice(0, 50) });
  }
  /** Fresh retained state is required after every connection/device transition. */
  invalidateAll(): void { this.update({ deviceOnline: false, entities: {}, valves: { clean_water_valve: false, fertigation_valve: false } }); }
  connected(): void { this.invalidateAll(); this.update({ brokerConnected: true }); this.log("connected to broker"); }
  closed(): void { this.update({ brokerConnected: false }); this.invalidateAll(); this.log("broker disconnected", "danger"); }
  error(error: Error): void { this.log(`broker error: ${error.message}`, "danger"); }
  setResetPending(resetPending: boolean): void { this.update({ resetPending }); }

  message(prefix: string, topic: string, payload: string): void {
    const parsed = parseStateTopic(prefix, topic);
    if (parsed.type === "status") { if (payload !== "online") this.invalidateAll(); else this.update({ deviceOnline: true }); this.log(`device ${payload}`, payload === "online" ? "normal" : "danger"); return; }
    if (parsed.type === "dryRun") { this.log("dry-run shutdown reported by device", "danger"); return; }
    if (parsed.type === "recoveryFlush") { this.log("fertigation cut short: recovery flush started", "danger"); return; }
    if (parsed.type === "resetResult") { this.handleResetResult(payload); return; }
    if (parsed.type !== "state") return;
    if (parsed.kind === "switch" && (parsed.objectId === "clean_water_valve" || parsed.objectId === "fertigation_valve")) { this.update({ valves: { ...this.snapshot.valves, [parsed.objectId]: payload === "ON" } }); this.log(`${parsed.objectId} → ${payload}`); return; }
    if (parsed.kind === "binary_sensor") { this.update({ entities: { ...this.snapshot.entities, [parsed.objectId]: { value: payload, known: true } } }); if (parsed.objectId === "irrigation_running") this.log(`irrigation ${payload === "ON" ? "started" : "stopped"}`); if (parsed.objectId === "battery_charged" && payload === "ON") this.log("battery charge complete"); return; }
    const value: EntityValue["value"] = parsed.kind === "switch" || parsed.kind === "select" ? payload : Number.parseFloat(payload);
    this.update({ entities: { ...this.snapshot.entities, [parsed.objectId]: { value, known: true } } });
  }

  handleResetResult(payload: string): void {
    const mapped: Record<string, [string, Severity]> = { success: ["total water reset", "normal"], already_zero: ["total water already zero", "normal"], rejected_pump_running: ["Device rejected reset: pump is running.", "danger"], rejected_flow_active: ["Device rejected reset: flow is active.", "danger"], rejected_flow_unknown: ["Device rejected reset: flow is unavailable.", "danger"], error_persistence: ["Device could not persist zero. The reset may not survive reboot.", "danger"] };
    const result = mapped[payload] ?? [`Unexpected reset response: ${payload}.`, "danger"];
    this.log(result[0], result[1]);
    this.setResetPending(false);
  }
}
