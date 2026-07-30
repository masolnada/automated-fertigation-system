import type { Snapshot } from "./store";
const entity = (snapshot: Snapshot, id: string) => snapshot.entities[id];
export function resetIneligibleReason(snapshot: Snapshot): string {
  if (!snapshot.brokerConnected || !snapshot.deviceOnline) return "Device or broker offline";
  const pump = entity(snapshot, "pump"), flow = entity(snapshot, "flow_rate"), total = entity(snapshot, "total_water");
  if (!pump?.known || !flow?.known || !total?.known) return "Waiting for state";
  if (pump.value === "ON") return "Pump running";
  const flowValue = Number(flow.value); if (!Number.isFinite(flowValue)) return "Flow unknown";
  if (flowValue >= 0.1) return "Flow active";
  const totalValue = Number(total.value); if (!Number.isFinite(totalValue)) return "Total unknown";
  if (totalValue <= 0) return "Already zero";
  if (snapshot.resetPending) return "Waiting for device";
  return "";
}
export const canReset = (snapshot: Snapshot) => resetIneligibleReason(snapshot) === "";
