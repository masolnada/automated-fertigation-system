import type { StateKind } from "@hort/contracts";

export type ParsedTopic =
  | { type: "state"; kind: StateKind; objectId: string }
  | { type: "status" | "dryRun" | "recoveryFlush" | "resetResult" | "debug" }
  | { type: "unknown" };

export function parseStateTopic(prefix: string, topic: string): ParsedTopic {
  if (!topic.startsWith(`${prefix}/`)) return { type: "unknown" };
  const relative = topic.slice(prefix.length + 1);
  if (relative === "status") return { type: "status" };
  if (relative === "flow/dry_run") return { type: "dryRun" };
  if (relative === "irrigation/recovery_flush") return { type: "recoveryFlush" };
  if (relative === "flow/reset_total/result") return { type: "resetResult" };
  if (relative === "debug") return { type: "debug" };
  const match = /^(sensor|binary_sensor|switch|number|select)\/([^/]+)\/state$/.exec(relative);
  return match ? { type: "state", kind: match[1] as StateKind, objectId: match[2]! } : { type: "unknown" };
}

export const topics = (prefix: string) => ({
  subscribe: `${prefix}/#`,
  status: `${prefix}/status`,
  resetRequest: `${prefix}/flow/reset_total/request`,
  switchCommand: (id: string) => `${prefix}/switch/${id}/command`,
  numberCommand: (id: string) => `${prefix}/number/${id}/command`,
  selectCommand: (id: string) => `${prefix}/select/${id}/command`,
  irrigationStart: `${prefix}/irrigation/start`,
  irrigationStop: `${prefix}/irrigation/stop`,
});
