import { parseStateTopic, topics } from "./topics";
export type Severity = "normal" | "danger";
export type LogEntry = { message: string; severity: Severity; time: Date };
export type EntityValue = { value: number | string; known: boolean };
export type Snapshot = { brokerConnected: boolean; deviceOnline: boolean; entities: Record<string, EntityValue>; valves: { clean_water_valve: boolean; fertigation_valve: boolean }; resetPending: boolean; log: LogEntry[] };
export type PublishClient = { publish(topic: string, payload: string, options?: { retain?: boolean }): void };
const empty = (): Snapshot => ({ brokerConnected: false, deviceOnline: false, entities: {}, valves: { clean_water_valve: false, fertigation_valve: false }, resetPending: false, log: [] });

export class DashboardStore {
  private snapshot = empty(); private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  private update(change: Partial<Snapshot>) { this.snapshot = { ...this.snapshot, ...change }; this.listeners.forEach((listener) => listener()); }
  log(message: string, severity: Severity = "normal") { this.update({ log: [{ message, severity, time: new Date() }, ...this.snapshot.log].slice(0, 50) }); }
  /** Fresh retained state is required after every connection/device transition. */
  invalidateAll() { this.update({ deviceOnline: false, entities: {}, valves: { clean_water_valve: false, fertigation_valve: false } }); }
  connected() { this.invalidateAll(); this.update({ brokerConnected: true }); this.log("connected to broker"); }
  closed() { this.update({ brokerConnected: false }); this.invalidateAll(); this.log("broker disconnected", "danger"); }
  error(error: Error) { this.log(`broker error: ${error.message}`, "danger"); }
  setResetPending(resetPending: boolean) { this.update({ resetPending }); }
  message(prefix: string, topic: string, payload: string): void {
    const parsed = parseStateTopic(prefix, topic);
    if (parsed.type === "status") { if (payload !== "online") this.invalidateAll(); else this.update({ deviceOnline: true }); this.log(`device ${payload}`, payload === "online" ? "normal" : "danger"); return; }
    if (parsed.type === "dryRun") { this.log("dry-run shutdown reported by device", "danger"); return; }
    if (parsed.type === "resetResult") { this.handleResetResult(payload); return; }
    if (parsed.type !== "state") return;
    if (parsed.kind === "switch" && (parsed.objectId === "clean_water_valve" || parsed.objectId === "fertigation_valve")) { this.update({ valves: { ...this.snapshot.valves, [parsed.objectId]: payload === "ON" } }); this.log(`${parsed.objectId} → ${payload}`); return; }
    if (parsed.kind === "binary_sensor") { this.update({ entities: { ...this.snapshot.entities, [parsed.objectId]: { value: payload, known: true } } }); if (parsed.objectId === "irrigation_running") this.log(`irrigation ${payload === "ON" ? "started" : "stopped"}`); if (parsed.objectId === "battery_charged" && payload === "ON") this.log("battery charge complete"); return; }
    const value = parsed.kind === "switch" ? payload : Number.parseFloat(payload);
    this.update({ entities: { ...this.snapshot.entities, [parsed.objectId]: { value, known: true } } });
  }
  handleResetResult(payload: string) { const mapped: Record<string, [string, Severity]> = { success: ["total water reset", "normal"], already_zero: ["total water already zero", "normal"], rejected_pump_running: ["Device rejected reset: pump is running.", "danger"], rejected_flow_active: ["Device rejected reset: flow is active.", "danger"], rejected_flow_unknown: ["Device rejected reset: flow is unavailable.", "danger"], error_persistence: ["Device could not persist zero. The reset may not survive reboot.", "danger"] }; const result = mapped[payload] ?? [`Unexpected reset response: ${payload}.`, "danger"]; this.log(result[0], result[1]); this.setResetPending(false); }
  requestReset(client: PublishClient, prefix: string) { this.setResetPending(true); client.publish(topics(prefix).resetRequest, "ON", { retain: false }); }
  selectValve(client: PublishClient, prefix: string, valve: "" | "clean_water_valve" | "fertigation_valve") { if (valve) client.publish(topics(prefix).switchCommand(valve), "ON"); else { client.publish(topics(prefix).switchCommand("clean_water_valve"), "OFF"); client.publish(topics(prefix).switchCommand("fertigation_valve"), "OFF"); } }
}
